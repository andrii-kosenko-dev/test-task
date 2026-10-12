import { envInt, envString } from './config';

describe('config', () => {
  it('reads a string with a fallback', () => {
    expect(envString({ A: 'x' }, 'A', 'd')).toBe('x');
    expect(envString({}, 'A', 'd')).toBe('d');
    expect(envString({ A: '' }, 'A', 'd')).toBe('d');
  });

  it('reads an integer with a fallback and rejects garbage', () => {
    expect(envInt({ P: '3001' }, 'P', 1)).toBe(3001);
    expect(envInt({}, 'P', 1)).toBe(1);
    expect(() => envInt({ P: 'abc' }, 'P', 1)).toThrow(/P/);
  });
});
