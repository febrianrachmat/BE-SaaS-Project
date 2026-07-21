export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);
}

export function withSlugSuffix(base: string, attempt: number): string {
  if (attempt <= 0) return base;
  const suffix = `-${attempt + 1}`;
  return `${base.slice(0, Math.max(1, 48 - suffix.length))}${suffix}`;
}
