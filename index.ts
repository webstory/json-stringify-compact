/** A rule that controls decimal precision for a specific path pattern. */
type FormatRule = {
  /** Dot-notation path pattern supporting `*` (single segment), `[*]` (array index), and `**` (any depth). */
  path: string;
  /** Number of decimal places to apply via `toFixed()`. */
  decimals: number;
};

/**
 * Options for {@link stringifyCompact}.
 */
type StringifyOptions = {
  /** Fallback decimal precision applied to all numbers that do not match any rule. */
  defaultDecimals?: number;
  /** Path-specific decimal formatting rules. Later rules take precedence over earlier ones. */
  rules?: FormatRule[];
  /**
   * Indentation size in spaces.
   * `0` (default) produces compact output; `2` or `4` produces pretty-printed output.
   */
  space?: number;
};

/**
 * Converts a glob-style path pattern into a `RegExp`.
 *
 * Supported wildcards:
 * - `[*]` — matches any array index (e.g. `[0]`, `[42]`)
 * - `*`   — matches a single path segment (e.g. `foo`, `bar`)
 * - `**`  — matches any number of nested segments at any depth
 *
 * @param pattern - The glob-style path pattern to compile.
 * @returns A `RegExp` that matches full path strings.
 */
function patternToRegex(pattern: string): RegExp {
  // Build regex source character-by-character to avoid chained replacements
  // clobbering wildcard fragments that contain * as quantifiers.
  const special = /[.+^${}()|\\[\]]/;
  let result = '';
  let i = 0;
  while (i < pattern.length) {
    const ch = pattern[i];
    if (ch === '*' && pattern[i + 1] === '*') {
      result += '(?:[^.[\\]]+(?:\\.|\\[\\d+\\])?)*[^.[\\]]*'; // ** → any depth
      i += 2;
    } else if (ch === '[' && pattern[i + 1] === '*' && pattern[i + 2] === ']') {
      result += '\\[\\d+\\]'; // [*] → array index
      i += 3;
    } else if (ch === '*') {
      result += '[^.[\\]]+'; // * → single segment
      i++;
    } else if (special.test(ch)) {
      result += '\\' + ch; // escape regex metacharacters
      i++;
    } else {
      result += ch;
      i++;
    }
  }
  return new RegExp(`^${result}$`);
}

/** A compiled rule with a pre-built `RegExp` for efficient repeated matching. */
type CompiledRule = { regex: RegExp; decimals: number };

/**
 * Pre-compiles a list of {@link FormatRule} objects into {@link CompiledRule} objects
 * by converting each path pattern to a `RegExp`.
 */
function compileRules(rules: FormatRule[]): CompiledRule[] {
  return rules.map(r => ({ regex: patternToRegex(r.path), decimals: r.decimals }));
}

/**
 * Resolves the decimal precision to apply for a given path.
 *
 * Rules are evaluated last-to-first so that later (more specific) rules win.
 *
 * @param path           - The dot-notation path of the current value.
 * @param compiled       - Pre-compiled rules to match against.
 * @param defaultDecimals - Fallback precision when no rule matches.
 * @returns The number of decimal places, or `undefined` if no rule matches and no default is set.
 */
function resolveDecimals(
  path: string,
  compiled: CompiledRule[],
  defaultDecimals?: number
): number | undefined {
  const rule = compiled.findLast(r => r.regex.test(path));
  if (rule) return rule.decimals;
  return defaultDecimals;
}

/**
 * Recursively serializes a value to a JSON string, applying decimal formatting rules
 * to numeric values based on their dot-notation path.
 *
 * @param value           - The value to serialize.
 * @param path            - The dot-notation path accumulated so far (empty string at root).
 * @param compiled        - Pre-compiled path-to-decimal rules.
 * @param defaultDecimals - Fallback decimal precision for unmatched numeric paths.
 * @param space           - Indentation size (`0` = compact, `>0` = pretty-printed).
 * @param depth           - Current nesting depth (used for indentation).
 * @returns The JSON string representation of `value`.
 */
function serialize(
  value: unknown,
  path: string,
  compiled: CompiledRule[],
  defaultDecimals: number | undefined,
  space: number,
  depth: number
): string {
  const indent = space > 0 ? ' '.repeat(space * depth) : '';
  const indentNext = space > 0 ? ' '.repeat(space * (depth + 1)) : '';
  const nl = space > 0 ? '\n' : '';
  const sp = space > 0 ? ' ' : '';

  if (typeof value === 'number') {
    if (!isFinite(value)) return 'null'; // NaN / Infinity → null, matching JSON.stringify behaviour
    const decimals = resolveDecimals(path, compiled, defaultDecimals);
    return decimals !== undefined ? value.toFixed(decimals) : String(value);
  }

  if (Array.isArray(value)) {
    if (value.length === 0) return '[]';
    const items = value.map((item, i) =>
      `${indentNext}${serialize(item, `${path}[${i}]`, compiled, defaultDecimals, space, depth + 1)}`
    );
    return `[${nl}${items.join(`,${nl}`)}${nl}${indent}]`;
  }

  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) return '{}';
    const lines = entries.map(([k, v]) => {
      const childPath = path ? `${path}.${k}` : k;
      const serialized = serialize(v, childPath, compiled, defaultDecimals, space, depth + 1);
      return `${indentNext}${JSON.stringify(k)}:${sp}${serialized}`;
    });
    return `{${nl}${lines.join(`,${nl}`)}${nl}${indent}}`;
  }

  return JSON.stringify(value);
}

/**
 * Serializes `data` to a JSON string with optional decimal precision control per path.
 *
 * Unlike `JSON.stringify`, this function lets you pin numeric fields to a fixed number
 * of decimal places using glob-style path patterns, without affecting the rest of the output.
 *
 * @param data    - The value to serialize (any JSON-compatible value).
 * @param options - Formatting options.
 * @returns A JSON string.
 *
 * @example
 * // Compact output, pin all numbers under "metrics" to 2 decimal places
 * stringifyCompact({ metrics: { cpu: 1.23456, mem: 0.5 } }, {
 *   rules: [{ path: 'metrics.*', decimals: 2 }],
 * });
 * // → '{"metrics":{"cpu":"1.23","mem":"0.50"}}'
 *
 * @example
 * // Pretty-printed with a global default of 3 decimal places
 * stringifyCompact({ a: 1.23456 }, { defaultDecimals: 3, space: 2 });
 */
export function stringifyCompact(data: unknown, options: StringifyOptions = {}): string {
  const { defaultDecimals, rules = [], space = 0 } = options;
  const compiled = compileRules(rules);
  return serialize(data, '', compiled, defaultDecimals, space, 0);
}