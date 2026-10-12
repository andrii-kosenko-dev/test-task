export const MAX_BUCKETS = 60;

const SECOND = 1_000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const NICE_BUCKETS_MS = [
  SECOND, 5 * SECOND, 10 * SECOND, 30 * SECOND,
  MINUTE, 5 * MINUTE, 10 * MINUTE, 15 * MINUTE, 30 * MINUTE,
  HOUR, 3 * HOUR, 6 * HOUR, 12 * HOUR,
  DAY, 7 * DAY, 30 * DAY,
];

/** Smallest round bucket size that keeps the chart at or under `MAX_BUCKETS` points. */
export function chooseBucketMs(rangeMs: number): number {
  const nice = NICE_BUCKETS_MS.find((b) => Math.ceil(rangeMs / b) <= MAX_BUCKETS);
  return nice ?? Math.ceil(rangeMs / MAX_BUCKETS);
}
