import { ROUTES, fetchLiveStatus, fetchSongjiangWeather } from "../transit.mjs";

export async function onRequest(context) {
  const { request } = context;

  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      }
    });
  }

  const url = new URL(request.url);
  const mode = url.searchParams.get("mode") || "evening";
  const routeConfig = ROUTES[mode] || ROUTES.evening;

  try {
    const [weather, ...options] = await Promise.all([
      fetchSongjiangWeather().catch(() => null),
      ...routeConfig.options.map(opt => fetchLiveStatus(opt))
    ]);

    return new Response(JSON.stringify({
      mode: routeConfig.mode,
      title: routeConfig.title,
      description: routeConfig.description,
      timestamp: new Date().toISOString(),
      weather,
      options
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-cache, no-store, must-revalidate"
      }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Access-Control-Allow-Origin": "*"
      }
    });
  }
}
