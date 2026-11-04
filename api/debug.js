import dns from "node:dns/promises";

export default async function handler(req, res) {
  const result = {
    now: new Date().toISOString(),
    env: process.env.VERCEL_REGION || "unknown",
  };

  try {
    const ips = await dns.resolve4("web.chelaile.net.cn");
    result.dns = ips;
  } catch (e) {
    result.dnsError = e.message;
  }

  try {
    const t0 = Date.now();
    const r = await fetch("https://web.chelaile.net.cn/api/bus/line!encryptedBusDetail.action", {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36",
        "Referer": "https://servicewechat.com/wx71d589ea01ce3321/814/page-frame.html"
      },
      signal: AbortSignal.timeout(5000)
    });
    result.httpsStatus = r.status;
    result.httpsDuration = Date.now() - t0;
    const txt = await r.text();
    result.httpsBody = txt.slice(0, 100);
  } catch (e) {
    result.httpsError = e.message;
  }

  res.status(200).json(result);
}
