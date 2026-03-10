/**
 * Real-world use case: AKView annotation schema v5
 *
 * Rounds timeRange and bbox timestamps to 1 decimal place,
 * and bbox points to 4 decimal places.
 */

import { stringifyCompact } from '@webstory/json-stringify-compact';

const input = await Bun.file(`${import.meta.dir}/input-akview-v5.json`).json();

const output = stringifyCompact(input, {
  space: 2,
  rules: [
    { path: 'annotations[*].timeRange[*]', decimals: 1 },
    { path: 'annotations[*].bbox[*].t', decimals: 1 },
    { path: 'annotations[*].bbox[*].points[*]', decimals: 4 },
  ],
});

console.log(output);
