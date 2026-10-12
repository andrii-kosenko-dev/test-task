import type { Document } from 'mongodb';

const WEIGHT_TITLE = 3;
const WEIGHT_META = 2;
const WEIGHT_BODY = 1;

/**
 * Aggregation for a non-blank query. `$match` hits the multikey `searchTokens` index; the score
 * is a per-token weight (title > brand/category > description) computed on the matches only;
 * paging and the total come from one `$facet`, so one round trip serves both.
 */
export function buildSearchPipeline(tokens: readonly string[], page: number, pageSize: number): Document[] {
  const perToken = {
    $map: {
      input: { $literal: tokens },
      as: 't',
      in: {
        $cond: [
          { $in: ['$$t', '$titleTokens'] },
          WEIGHT_TITLE,
          { $cond: [{ $in: ['$$t', '$metaTokens'] }, WEIGHT_META, WEIGHT_BODY] },
        ],
      },
    },
  };
  return [
    { $match: { searchTokens: { $all: [...tokens] } } },
    { $addFields: { score: { $sum: perToken } } },
    { $sort: { score: -1, id: 1 } },
    {
      $facet: {
        items: [
          { $skip: page * pageSize },
          { $limit: pageSize },
          { $project: { _id: 0, score: 0, searchTokens: 0, titleTokens: 0, metaTokens: 0 } },
        ],
        total: [{ $count: 'n' }],
      },
    },
  ];
}
