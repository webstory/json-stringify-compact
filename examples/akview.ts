/** Manual test for the AKView annotation schema v5 */

import { stringifyCompact } from '@webstory/json-stringify-compact';

const input = await Bun.file(`${import.meta.dir}/input-akview-v5.json`).json();

const output = stringifyCompact(input, {
  space: 2,
  rules: [
    { path: '/annotations/timeRange', decimals: 1 },
    { path: '/annotations/*/bbox[*]/t', decimals: 1 },
    { path: '/annotations/*/bbox[*]/points', decimals: 4 },
  ],
});

console.log(output);
