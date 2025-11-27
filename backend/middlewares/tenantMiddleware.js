const normalizeHost = (rawHost = '') => {
  if (!rawHost) return null;
  return rawHost.split(':')[0].trim().toLowerCase();
};

export const tenantMiddleware = (req, _res, next) => {
  const mainDomain = (process.env.MAIN_DOMAIN || process.env.FRONTEND_URL || 'localhost')
    .replace(/^https?:\/\//, '')
    .toLowerCase();

  let tenant = 'main';
  let source = 'default';

  if (req.headers['x-tenant']) {
    tenant = String(req.headers['x-tenant']).toLowerCase();
    source = 'header';
  } else {
    const host =
      normalizeHost(req.headers['x-forwarded-host']) ||
      normalizeHost(req.headers['host']);

    if (host && host !== mainDomain) {
      if (host.endsWith(`.${mainDomain}`)) {
        const slugCandidate = host.slice(0, -(mainDomain.length + 1));
        if (slugCandidate) {
          tenant = slugCandidate;
          source = 'subdomain';
        }
      } else {
        tenant = host;
        source = 'custom-domain';
      }
    } else if (host === mainDomain) {
      source = 'root-domain';
    }
  }

  req.tenant = tenant;
  req.tenantSource = source;
  next();
};


