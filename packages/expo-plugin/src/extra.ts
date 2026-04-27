/**
 * Normalizes Expo extra payload access for rn-mt target context.
 */
function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Returns rn mt extra.
 */
export function getRnMtExtra(extra: Record<string, unknown> | undefined) {
  const rnMt = extra?.rnMt;

  return isPlainRecord(rnMt) ? rnMt : {};
}
