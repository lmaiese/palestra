/**
 * Number of set rows implied by a prescription: "3x6" → 3,
 * "1x5 @RPE 7 + 3x5 @-10%" → 4, "3-4x5" → 3, "3 singole progressive → 1x3 max" → 4.
 */
export function setsInPrescription(rx: string): number {
  let n = 0;
  for (const m of rx.matchAll(/(\d+)(?:\s*-\s*\d+)?\s*[x×]\s*\d/gi)) n += Number(m[1]);
  for (const m of rx.matchAll(/(\d+)\s+singol/gi)) n += Number(m[1]);
  return Math.min(8, Math.max(1, n));
}
