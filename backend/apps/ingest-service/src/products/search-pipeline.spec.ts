import { buildSearchPipeline } from './search-pipeline';

describe('buildSearchPipeline', () => {
  it('matches every token through the indexed multikey field', () => {
    const [match] = buildSearchPipeline(['red', 'li'], 0, 10);
    expect(match).toEqual({ $match: { searchTokens: { $all: ['red', 'li'] } } });
  });

  it('ranks by weighted token hits then id, and pages inside one $facet with a total', () => {
    const pipeline = buildSearchPipeline(['red'], 2, 10);
    expect(pipeline.map((s) => Object.keys(s)[0])).toEqual(['$match', '$addFields', '$sort', '$facet']);
    expect(pipeline[2]).toEqual({ $sort: { score: -1, id: 1 } });
    const facet = (pipeline[3] as { $facet: { items: object[]; total: object[] } }).$facet;
    expect(facet.items).toEqual([
      { $skip: 20 },
      { $limit: 10 },
      { $project: { _id: 0, score: 0, searchTokens: 0, titleTokens: 0, metaTokens: 0 } },
    ]);
    expect(facet.total).toEqual([{ $count: 'n' }]);
  });
});
