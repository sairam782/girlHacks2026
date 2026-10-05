import { createHash, timingSafeEqual } from 'node:crypto';

const digest = (value: string) => createHash('sha256').update(value).digest();

/** Credentials are checked for every deletion, before any database work. */
export async function requireProjectDeleteCredentials(req: Request): Promise<Response | null> {
  const expectedUser = process.env.CANOPY_DELETE_USERNAME;
  const expectedPassword = process.env.CANOPY_DELETE_PASSWORD;
  const headers = { 'Cache-Control': 'no-store' };
  if (!expectedUser || !expectedPassword) {
    return Response.json({ error: 'Project deletion is unavailable until administrator credentials are configured.' }, { status: 503, headers });
  }

  let body: unknown;
  try { body = await req.json(); } catch { /* Treat missing or malformed credentials as unauthorized. */ }
  const input = body && typeof body === 'object' && !Array.isArray(body)
    ? body as Record<string, unknown> : {};
  const username = typeof input.username === 'string' ? input.username : '';
  const password = typeof input.password === 'string' ? input.password : '';
  if (username.length > 100 || password.length > 256) {
    return Response.json({ error: 'Incorrect username or password.' }, { status: 401, headers });
  }
  // Fixed-length digests avoid both timing differences and length-based exceptions.
  const userMatches = timingSafeEqual(digest(username), digest(expectedUser));
  const passwordMatches = timingSafeEqual(digest(password), digest(expectedPassword));
  if (!userMatches || !passwordMatches) {
    return Response.json({ error: 'Incorrect username or password.' }, { status: 401, headers });
  }
  return null;
}
