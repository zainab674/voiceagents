export const RESERVED_SLUGS = new Set([
  'www',
  'api',
  'admin',
  'app',
  'mail',
  'ftp',
  'localhost',
  'main',
  'test',
  'staging',
  'dev',
  'prod'
]);

export const SLUG_REGEX = /^[a-z0-9-]+$/;

export const normalizeSlug = (slug = '') => String(slug).trim().toLowerCase();

export const validateSlug = (slug) => {
  const normalized = normalizeSlug(slug);
  if (!normalized) {
    return { valid: false, message: 'Slug is required' };
  }

  if (!SLUG_REGEX.test(normalized)) {
    return { valid: false, message: 'Slug can only contain lowercase letters, numbers, and hyphens' };
  }

  if (normalized.length < 3 || normalized.length > 50) {
    return { valid: false, message: 'Slug must be between 3 and 50 characters' };
  }

  if (RESERVED_SLUGS.has(normalized)) {
    return { valid: false, message: 'Slug is reserved' };
  }

  return { valid: true, slug: normalized };
};


