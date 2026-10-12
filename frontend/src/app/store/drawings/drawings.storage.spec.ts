import { DRAWINGS_STORAGE_KEY, LocalStorageDrawings } from './drawings.storage';

const poly = {
  id: '1',
  points: [
    { x: 0, y: 0 },
    { x: 0.1, y: 0 },
    { x: 0.1, y: 0.1 },
  ],
};

describe('LocalStorageDrawings', () => {
  beforeEach(() => localStorage.clear());

  it('round-trips drawings', () => {
    const storage = new LocalStorageDrawings();
    storage.save({ a: [poly] });
    expect(storage.load()).toEqual({ a: [poly] });
  });

  it('returns an empty record when nothing is stored', () => {
    expect(new LocalStorageDrawings().load()).toEqual({});
  });

  it('ignores corrupt or malformed data', () => {
    localStorage.setItem(DRAWINGS_STORAGE_KEY, '{nope');
    expect(new LocalStorageDrawings().load()).toEqual({});
    localStorage.setItem(
      DRAWINGS_STORAGE_KEY,
      JSON.stringify({ a: 'x', b: [{ id: 1 }], c: [poly] }),
    );
    expect(new LocalStorageDrawings().load()).toEqual({ c: [poly] });
  });

  it('does not throw when storage is unavailable', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    expect(() => new LocalStorageDrawings().save({ a: [poly] })).not.toThrow();
    spy.mockRestore();
  });
});
