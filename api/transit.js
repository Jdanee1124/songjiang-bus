import { ROUTES, fetchLiveStatus } from "../transit.mjs";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  const { mode = "evening" } = req.query;
  const routeConfig = ROUTES[mode] || ROUTES.evening;

  try {
    const results = await Promise.all(routeConfig.options.map(opt => fetchLiveStatus(opt)));
    res.status(200).json({
      mode: routeConfig.mode,
      title: routeConfig.title,
      description: routeConfig.description,
      timestamp: new Date().toISOString(),
      options: results
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
