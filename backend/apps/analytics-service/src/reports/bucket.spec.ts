import { chooseBucketMs, MAX_BUCKETS } from './bucket';

describe('chooseBucketMs', () => {
  it.each([
    [30_000, 1_000],
    [60 * 60_000, 60_000],
    [24 * 3600_000, 30 * 60_000],
    [7 * 24 * 3600_000, 3 * 3600_000],
  ])('range %d ms -> bucket %d ms', (range, bucket) => expect(chooseBucketMs(range)).toBe(bucket));

  it('never produces more than MAX_BUCKETS buckets, even for huge ranges', () => {
    for (const days of [1, 30, 365, 3650]) {
      const range = days * 86_400_000;
      expect(Math.ceil(range / chooseBucketMs(range))).toBeLessThanOrEqual(MAX_BUCKETS);
    }
  });

  it('floors tiny ranges at one second', () => expect(chooseBucketMs(10)).toBe(1_000));
});
