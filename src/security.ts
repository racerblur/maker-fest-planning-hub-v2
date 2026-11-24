import { createMiddleware } from 'hono/factory';
import { createRemoteJWKSet, jwtVerify } from 'jose';

export type Env = {
  Bindings: { DB: D1Database; ACCESS_TEAM_DOMAIN?: string; ACCESS_AUD?: string };
  Variables: { email: string; role: 'admin' | 'editor' };
};

let keys: ReturnType<typeof createRemoteJWKSet> | undefined;
let issuerForKeys: string | undefined;

export const protectAdmin = createMiddleware<Env>(async (c, next) => {
  c.header('Cache-Control', 'private, no-store');
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('Content-Security-Policy', "default-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
  const issuer = c.env.ACCESS_TEAM_DOMAIN?.replace(/\/$/, '');
  const audience = c.env.ACCESS_AUD;
  if (!issuer?.startsWith('https://') || !audience) return c.text('Admin access is unavailable', 503);
  const token = c.req.header('Cf-Access-Jwt-Assertion');
  if (!token) return c.text('Authentication required', 401);
  let email: string;
  try {
    if (!keys || issuerForKeys !== issuer) {
      keys = createRemoteJWKSet(new URL('/cdn-cgi/access/certs', issuer));
      issuerForKeys = issuer;
    }
    const { payload } = await jwtVerify(token, keys, {
      issuer, audience, algorithms: ['RS256'], requiredClaims: ['exp', 'email'],
    });
    if (typeof payload.email !== 'string' || !payload.email.trim()) return c.text('Forbidden', 403);
    email = payload.email.trim().toLowerCase();
  } catch {
    return c.text('Invalid authentication', 401);
  }
  const account = await c.env.DB.prepare('SELECT role FROM cms_users WHERE email=? AND archived_at IS NULL')
    .bind(email).first<{ role: Env['Variables']['role'] }>();
  const role = account?.role;
  if (!role) return c.text('A CMS role is required', 403);

  if (c.req.method === 'POST') {
    if (c.req.header('origin') !== new URL(c.req.url).origin || c.req.header('sec-fetch-site') === 'cross-site') {
      return c.text('Cross-origin requests are forbidden', 403);
    }
    if (c.req.header('content-type')?.split(';')[0] !== 'application/x-www-form-urlencoded') {
      return c.text('Unsupported form format', 415);
    }
  }
  c.set('email', email);
  c.set('role', role);
  await next();
});
