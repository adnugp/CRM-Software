export function recordTime(value: unknown): number | undefined {
  const candidate = value instanceof Date ? value.getTime() : typeof value === 'string' ? Date.parse(value) : value && typeof value === 'object' && 'seconds' in value ? Number(value.seconds) * 1000 : NaN;
  return Number.isFinite(candidate) ? candidate : undefined;
}
/** Equal duration windows; never infer a percent increase from a zero baseline. */
export function creationWindows(records: {createdAt?: unknown}[], now = Date.now(), days = 30) {
  const duration = days * 86400000;
  let current = 0, previous = 0, undated = 0;
  for (const record of records) {
    const time = recordTime(record.createdAt);
    if (time === undefined) { undated++; continue; }
    if (time >= now - duration && time <= now) current++;
    else if (time >= now - 2 * duration && time < now - duration) previous++;
  }
  const change = previous ? Math.round((current - previous) / previous * 100) : undefined;
  return {current, previous, undated, change};
}
