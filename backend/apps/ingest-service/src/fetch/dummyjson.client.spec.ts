import { DummyJsonClient } from './dummyjson.client';

const product = (id: number) => ({
  id, title: `P${id}`, description: 'd', category: 'c', price: 1, thumbnail: 't', images: ['i'], rating: 5,
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

describe('DummyJsonClient', () => {
  it('pages through every product until total is reached', async () => {
    const all = Array.from({ length: 25 }, (_, i) => product(i + 1));
    const fetchFn = jest.fn(async (url: string | URL | Request) => {
      const u = new URL(String(url));
      const skip = Number(u.searchParams.get('skip'));
      const limit = Number(u.searchParams.get('limit'));
      return jsonResponse({ products: all.slice(skip, skip + limit), total: 25, skip, limit });
    });
    const client = new DummyJsonClient({ baseUrl: 'https://dj.test', pageSize: 10, fetchFn, retries: 0 });

    const result = await client.fetchAllProducts();

    expect(result.products.map((p) => p.id)).toEqual(all.map((p) => p.id));
    expect(result.skipped).toBe(0);
    expect(fetchFn).toHaveBeenCalledTimes(3);
    expect(String(fetchFn.mock.calls[1]?.[0])).toBe('https://dj.test/products?limit=10&skip=10');
  });

  it('skips invalid products and counts them', async () => {
    const fetchFn = jest.fn(async () => jsonResponse({ products: [product(1), { id: 'x' }], total: 2 }));
    const result = await new DummyJsonClient({ baseUrl: 'https://dj.test', pageSize: 10, fetchFn, retries: 0 }).fetchAllProducts();
    expect(result.products).toHaveLength(1);
    expect(result.skipped).toBe(1);
  });

  it('retries transient failures then succeeds', async () => {
    const fetchFn = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse({}, 503))
      .mockResolvedValueOnce(jsonResponse({ products: [product(1)], total: 1 }));
    const client = new DummyJsonClient({ baseUrl: 'https://dj.test', pageSize: 10, fetchFn, retries: 1, retryDelayMs: 0 });
    expect((await client.fetchAllProducts()).products).toHaveLength(1);
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('fails after exhausting retries', async () => {
    const fetchFn = jest.fn().mockResolvedValue(jsonResponse({}, 500));
    const client = new DummyJsonClient({ baseUrl: 'https://dj.test', pageSize: 10, fetchFn, retries: 1, retryDelayMs: 0 });
    await expect(client.fetchAllProducts()).rejects.toThrow(/500/);
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('stops on an empty page even if total is larger (no infinite loop)', async () => {
    const fetchFn = jest.fn().mockResolvedValue(jsonResponse({ products: [], total: 99 }));
    const result = await new DummyJsonClient({ baseUrl: 'https://dj.test', pageSize: 10, fetchFn, retries: 0 }).fetchAllProducts();
    expect(result.products).toEqual([]);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });
});
