/**
 * The Academy's edge. Workers Static Assets serves the SPA without running this script;
 * only the `run_worker_first` paths land here, and they are forwarded to the API on Render.
 * One origin for the browser means first-party cookies and no CORS for the Academy itself.
 */

const PROXIED_PREFIXES = ['/api/', '/uploads/'];

function isProxied(pathname: string) {
  return pathname === '/healthz' || PROXIED_PREFIXES.some(prefix => pathname.startsWith(prefix));
}

async function proxy(request: Request, url: URL, env: Env): Promise<Response> {
  const target = new URL(url.pathname + url.search, env.API_ORIGIN);
  const upstream = new Request(target, request);

  // Render routes on Host, so it must be Render's own; the public host travels separately.
  upstream.headers.delete('Host');
  upstream.headers.set('X-Forwarded-Host', url.host);
  upstream.headers.set('X-Forwarded-Proto', url.protocol.replace(':', ''));

  // The real visitor address, vouched for with the shared secret so the API can trust it.
  const visitor = request.headers.get('CF-Connecting-IP');
  if (visitor) upstream.headers.set('X-Forwarded-For', visitor);
  if (env.PROXY_SHARED_SECRET) upstream.headers.set('X-Academy-Proxy', env.PROXY_SHARED_SECRET);

  try {
    // Bodies stream both ways, so uploads and video never sit in Worker memory.
    const response = await fetch(upstream, { redirect: 'manual' });
    return new Response(response.body, response);
  } catch (error) {
    console.error(
      JSON.stringify({
        message: 'api unreachable',
        path: url.pathname,
        error: error instanceof Error ? error.message : String(error)
      })
    );
    return Response.json(
      { error: 'The Academy is briefly unavailable. Try again in a moment.', code: 'UPSTREAM_UNAVAILABLE' },
      { status: 502 }
    );
  }
}

export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url);
    if (isProxied(url.pathname)) return proxy(request, url, env);
    return env.ASSETS.fetch(request);
  }
} satisfies ExportedHandler<Env>;
