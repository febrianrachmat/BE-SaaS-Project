import { slugify, withSlugSuffix } from './slug.util';

describe('slugify', () => {
  it('normalizes names into URL-safe slugs', () => {
    expect(slugify('Acme Studio')).toBe('acme-studio');
    expect(slugify('  Hello---World!! ')).toBe('hello-world');
  });

  it('truncates long inputs', () => {
    const long = 'a'.repeat(80);
    expect(slugify(long).length).toBeLessThanOrEqual(48);
  });
});

describe('withSlugSuffix', () => {
  it('returns base for first attempt', () => {
    expect(withSlugSuffix('acme', 0)).toBe('acme');
  });

  it('appends numeric suffix for collisions', () => {
    expect(withSlugSuffix('acme', 1)).toBe('acme-2');
    expect(withSlugSuffix('acme', 2)).toBe('acme-3');
  });
});
