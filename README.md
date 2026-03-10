# json-stringify-compact

> JSON serialization with per-path decimal precision control.

`stringifyCompact` is a drop-in alternative to `JSON.stringify` that lets you pin specific numeric fields to a fixed number of decimal places using glob-style path patterns — without touching the rest of your data.

## Features

- Pin numeric fields to exact decimal places via dot-notation path patterns
- Glob-style wildcards: `*` (single segment), `[*]` (array index), `**` (any depth)
- Later rules win — compose coarse defaults with precise overrides
- Compact or pretty-printed output (`space` option, same as `JSON.stringify`)
- Zero dependencies, pure TypeScript

## Installation

```bash
# npm
npm install @webstory/json-stringify-compact

# pnpm
pnpm add @webstory/json-stringify-compact

# bun
bun add @webstory/json-stringify-compact
```

## Usage

```ts
import { stringifyCompact } from '@webstory/json-stringify-compact';
```

### Basic example

```ts
const data = {
  name: 'sensor-A',
  reading: 1.23456789,
};

stringifyCompact(data);
// → '{"name":"sensor-A","reading":1.23456789}'

stringifyCompact(data, { defaultDecimals: 2 });
// → '{"name":"sensor-A","reading":1.23}'
```

### Path rules

```ts
const data = {
  metrics: { cpu: 0.987654, mem: 0.512345 },
  version: 1.0,
};

stringifyCompact(data, {
  rules: [
    { path: 'metrics.*', decimals: 2 },
  ],
});
// → '{"metrics":{"cpu":0.99,"mem":0.51},"version":1}'
```

### Array paths

```ts
const data = {
  readings: [1.23456, 2.34567, 3.45678],
};

stringifyCompact(data, {
  rules: [{ path: 'readings[*]', decimals: 1 }],
});
// → '{"readings":[1.2,2.3,3.5]}'
```

### Deep wildcard (`**`)

```ts
const data = {
  a: { b: { c: { value: 1.23456 } } },
};

stringifyCompact(data, {
  rules: [{ path: '**.value', decimals: 2 }],
});
// → '{"a":{"b":{"c":{"value":1.23}}}}'
```

### Rule precedence

Rules are evaluated in order, with **later rules taking precedence** over earlier ones.

```ts
stringifyCompact(data, {
  defaultDecimals: 4,
  rules: [
    { path: '**',           decimals: 4 },  // broad default
    { path: 'metrics.*',    decimals: 2 },  // more specific — wins
  ],
});
```

### Pretty-printed output

```ts
stringifyCompact({ a: 1.5, b: [2.5, 3.5] }, {
  defaultDecimals: 1,
  space: 2,
});
// →
// {
//   "a": 1.5,
//   "b": [
//     2.5,
//     3.5
//   ]
// }
```

## API

### `stringifyCompact(data, options?)`

| Parameter | Type | Description |
|-----------|------|-------------|
| `data` | `unknown` | Any JSON-serializable value |
| `options` | `StringifyOptions` | Optional formatting options |

**Returns:** `string` — the JSON-serialized output.

### `StringifyOptions`

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `defaultDecimals` | `number` | `undefined` | Decimal precision for all numbers not matched by a rule |
| `rules` | `FormatRule[]` | `[]` | Per-path decimal rules; later entries override earlier ones |
| `space` | `number` | `0` | Indentation size in spaces (`0` = compact, `2`/`4` = pretty) |

### `FormatRule`

| Field | Type | Description |
|-------|------|-------------|
| `path` | `string` | Dot-notation path pattern (supports `*`, `[*]`, `**`) |
| `decimals` | `number` | Number of decimal places to apply via `toFixed()` |

### Path pattern syntax

| Pattern | Matches |
|---------|---------|
| `foo` | Exactly the key `foo` at the root |
| `foo.bar` | Nested key `bar` inside `foo` |
| `foo.*` | Any direct child of `foo` |
| `foo[*]` | Any element of the array `foo` |
| `**.value` | Any key named `value` at any depth |
| `**` | Every node at any depth |

## Development

```bash
# Install dependencies
npm install

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Build for publishing
npm run build

# Type-check without emitting
npm run typecheck
```

## License

MIT — [Hoya Kim](mailto:wbstory@storymate.net)
