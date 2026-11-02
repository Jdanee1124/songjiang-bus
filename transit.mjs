import { createHash, createDecipheriv } from "node:crypto";
import * as https from "node:https";
import * as http from "node:http";
import * as zlib from "node:zlib";

const BASE_DOMAIN = "https://web.chelaile.net.cn";
const BASE_URL = `${BASE_DOMAIN}/api`;
const SIGN_SALT = "qwihrnbtmj";
const AES_KEY = "FF32AE65FBFD19414EAAFF6291A54B42";

const DEFAULT_PARAMS = {
  s: "h5",
  wxs: "wx_app",
  sign: "1",
  h5RealData: "1",
  v: "3.11.28",
  src: "weixinapp_cx",
  ctm_mp: "mp_wx",
  vc: "2",
  favoriteGray: "1",
  gpstype: "wgs",
  geo_type: "wgs",
  scene: "1256",
};

const REQUEST_HEADERS = {
  Host: "web.chelaile.net.cn",
  Connection: "keep-alive",
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36 MicroMessenger/7.0.20.1781(0x6700143B) NetType/WIFI MiniProgramEnv/Windows WindowsWechat/WMPF WindowsWechat(0x63090a13) UnifiedPCWindowsWechat(0xf254160a) XWEB/18055",
  xweb_xhr: "1",
  "Content-Type": "text",
  Accept: "*/*",
  "Sec-Fetch-Site": "cross-site",
  "Sec-Fetch-Mode": "cors",
  "Sec-Fetch-Dest": "empty",
  Referer: "https://servicewechat.com/wx71d589ea01ce3321/814/page-frame.html",
  "Accept-Encoding": "gzip, deflate, br",
  "Accept-Language": "zh-CN,zh;q=0.9",
};

function cryptoSign(params) {
  const str = Object.entries(params)
    .map(([k, v]) => `"${k}"="${v}"`)
    .join("&") + SIGN_SALT;
  return createHash("md5").update(str).digest("hex");
}

function decryptResult(ciphertext) {
  const key = Buffer.from(AES_KEY, "utf8");
  const decipher = createDecipheriv("aes-256-ecb", key, null);
  let decrypted = decipher.update(ciphertext, "base64", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

function parseEncryptedEnvelope(raw) {
  const jsonStart = raw.indexOf("{");
  if (jsonStart < 0) throw new Error("Upstream response is not JSON");
  let depth = 0;
  let jsonEnd = jsonStart;
  for (let i = jsonStart; i < raw.length; i++) {
    if (raw[i] === "{") depth++;
    else if (raw[i] === "}") depth--;
    if (depth === 0) {
      jsonEnd = i + 1;
      break;
    }
  }
  const envelope = JSON.parse(raw.substring(jsonStart, jsonEnd));
  const data = envelope.jsonr?.data;
  if (!data) throw new Error("Upstream response missing jsonr.data");
  if (data.encryptResult) {
    return JSON.parse(decryptResult(data.encryptResult));
  }
  return data;
}

function decompress(buffer, encoding) {
  if (encoding === "br") return zlib.brotliDecompressSync(buffer);
  if (encoding === "gzip") return zlib.gunzipSync(buffer);
  if (encoding === "deflate") return zlib.inflateSync(buffer);
  return buffer;
}

function rawGet(url) {
  const client = url.protocol === "https:" ? https : http;
  return new Promise((resolve, reject) => {
    const req = client.request({
      hostname: url.hostname,
      port: url.port || (url.protocol === "https:" ? 443 : 80),
      path: url.pathname + (url.search || ""),
      method: "GET",
      headers: REQUEST_HEADERS,
      timeout: 10000,
    }, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => {
        try {
          const buf = Buffer.concat(chunks);
          const decompressed = decompress(buf, res.headers["content-encoding"]);
          resolve({ body: decompressed.toString("utf-8") });
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on("timeout", () => req.destroy(new Error("Request timed out")));
    req.on("error", reject);
    req.end();
  });
}

export async function request(url, params) {
  const signed = { ...params, cryptoSign: cryptoSign(params) };
  const u = new URL(url);
  u.search = new URLSearchParams(signed).toString();
  const { body } = await rawGet(u);
  return parseEncryptedEnvelope(body);
}

// Transit definitions
export const ROUTES = {
  // 下班: 公司 -> 家
  evening: {
    mode: "evening",
    title: "下班回家",
    description: "从公司返回松江新城/大学城",
    options: [
      {
        id: "songxin_b",
        name: "方案一：骑行1.5km + 松莘B线",
        badge: "直达一趟车",
        lineName: "松莘B线",
        directionText: "开往 松江大学城 方向",
        stopName: "莘砖公路千帆路（漕河泾园区）",
        destStopName: "嘉松南路梅家浜路",
        commuteMode: "bike_bus",
        prepTimeMinutes: 6, // 骑车约6分钟
        lineId: "21283603506",
        targetOrder: "10",
        stationId: "021-24911",
        lat: "31.094166",
        lng: "121.314916",
        totalTripTime: "~50分钟 (直达)",
      },
      {
        id: "songjiang_40",
        name: "方案二：楼下松江40路 + 地铁9号线",
        badge: "楼下近 / 需换乘",
        lineName: "松江40路",
        directionText: "开往 九亭地铁站 方向",
        stopName: "中心路云凯路（公司楼下）",
        destStopName: "沪松公路沪亭北路（九亭地铁站）",
        commuteMode: "walk_bus_metro",
        prepTimeMinutes: 2, // 步行2分钟
        lineId: "21283604407",
        targetOrder: "3",
        stationId: "021-17190",
        lat: "31.1090",
        lng: "121.3230",
        totalTripTime: "~40分钟 (公交20m+地铁20m)",
      }
    ]
  },
  // 上班: 家 -> 公司
  morning: {
    mode: "morning",
    title: "早晨上班",
    description: "从松江出发前往公司",
    options: [
      {
        id: "songxin_b_morning",
        name: "方案一：松莘B线 + 骑行1.5km",
        badge: "家门口直达",
        lineName: "松莘B线",
        directionText: "开往 莘庄/外环路地铁站 方向",
        stopName: "嘉松南路梅家浜路",
        destStopName: "莘砖公路漕泽路（漕河泾园区）",
        commuteMode: "bus_bike",
        prepTimeMinutes: 3, // 步行到站3分钟
        lineId: "21283603505",
        targetOrder: "8",
        stationId: "021-19552",
        lat: "31.057196",
        lng: "121.227666",
        totalTripTime: "~50分钟 (松莘B线50m+骑行6m)",
      },
      {
        id: "songjiang_40_morning",
        name: "方案二：地铁9号线九亭站 + 松江40路",
        badge: "九亭出站乘车",
        lineName: "松江40路",
        directionText: "开往 中心路云凯路 方向",
        stopName: "沪松公路沪亭北路（九亭地铁站）",
        destStopName: "中心路云凯路（公司楼下）",
        commuteMode: "metro_bus",
        prepTimeMinutes: 2, // 出地铁2分钟
        lineId: "21283604408",
        targetOrder: "13",
        stationId: "021-11684",
        lat: "31.139886",
        lng: "121.315046",
        totalTripTime: "~40分钟 (地铁20m+松江40路20m)",
      }
    ]
  }
};

export async function fetchLiveStatus(option) {
  try {
    const raw = await request(`${BASE_URL}/bus/line!encryptedBusDetail.action`, {
      ...DEFAULT_PARAMS,
      cshow: "busDetail",
      specail: "0",
      specialType: "undefined",
      cityId: "034",
      localCityId: "034",
      lineId: option.lineId,
      targetOrder: option.targetOrder,
      specialTargetOrder: option.targetOrder,
      stationId: option.stationId,
      lat: option.lat,
      lng: option.lng,
      geo_lat: option.lat,
      geo_lng: option.lng,
      userId: "",
      h5Id: "",
      unionId: "",
      accountId: "",
      secret: ""
    });

    const targetOrder = parseInt(option.targetOrder, 10);
    const buses = raw.buses || [];
    
    // Filter approaching buses (order <= targetOrder)
    const approaching = buses
      .filter(b => b.order <= targetOrder)
      .map(b => {
        const stopsAway = targetOrder - b.order;
        let etaMinutes = null;
        let etaTimeStr = "";
        
        if (b.travels && b.travels.length > 0 && b.travels[0].travelTime > 0) {
          etaMinutes = Math.round(b.travels[0].travelTime / 60);
          etaTimeStr = b.travels[0].recommTip || "";
        } else {
          // Fallback estimate: ~2.5 min per stop
          etaMinutes = Math.max(1, Math.round(stopsAway * 2.5));
        }

        return {
          busId: b.busId,
          order: b.order,
          stopsAway,
          distanceMeters: b.distanceToWaitStn > 0 ? b.distanceToWaitStn : null,
          etaMinutes,
          etaTimeStr,
          speed: b.speed,
        };
      })
      .sort((a, b) => a.stopsAway - b.stopsAway);

    const nextBus = approaching[0] || null;
    const secondBus = approaching[1] || null;

    // Decision calculation
    let decision = {
      level: "normal", // 'urgent', 'perfect', 'wait', 'missed'
      tag: "查询中",
      tip: "",
      color: "#6b7280"
    };

    if (!nextBus) {
      if (raw.depDesc) {
        decision = {
          level: "wait",
          tag: "等待发车",
          tip: raw.depDesc,
          color: "#f59e0b"
        };
      } else {
        decision = {
          level: "wait",
          tag: "暂无来车",
          tip: "当前区间暂未发现运行车辆，可能在总站等待发车",
          color: "#9ca3af"
        };
      }
    } else {
      const eta = nextBus.etaMinutes;
      const prep = option.prepTimeMinutes; // 骑车或步行用时

      const isMorning = option.id.includes("morning");

      if (eta < prep - 1) {
        decision = {
          level: "missed",
          tag: isMorning ? "刚进站，别狂奔" : "赶不上，别急",
          tip: isMorning
            ? `公交预计 ${eta} 分钟后进站，出门已来不及，别着急狂奔，等下一班更稳妥！`
            : `公交预计 ${eta} 分钟后进站，你出发需要 ${prep} 分钟，大概率赶不上，别冒险狂奔！`,
          color: "#ef4444"
        };
      } else if (eta >= prep - 1 && eta <= prep + 4) {
        decision = {
          level: "perfect",
          tag: isMorning ? "绝佳时机！准备出门" : "绝佳时机！立刻出发",
          tip: isMorning
            ? `公交预计 ${eta} 分钟（${nextBus.stopsAway} 站）后到，现在穿鞋出门/出地铁刚好无缝上车！`
            : `公交预计 ${eta} 分钟（${nextBus.stopsAway} 站）后到，现在打卡扫车，到站刚好直接上车！`,
          color: "#10b981"
        };
      } else if (eta > prep + 4 && eta <= prep + 12) {
        decision = {
          level: "normal",
          tag: "时间充裕",
          tip: isMorning
            ? `公交预计 ${eta} 分钟后到（还剩 ${nextBus.stopsAway} 站），时间很从容，慢悠悠准备出门。`
            : `公交预计 ${eta} 分钟后到（还剩 ${nextBus.stopsAway} 站），可收拾工位、打卡慢悠悠走。`,
          color: "#3b82f6"
        };
      } else {
        decision = {
          level: "wait",
          tag: "需等待较久",
          tip: isMorning
            ? `预计还有 ${eta} 分钟到达（${nextBus.stopsAway} 站），可以在家里慢悠悠吃早餐或看另一方案。`
            : `预计还有 ${eta} 分钟到达（${nextBus.stopsAway} 站），建议看另一方案对比。`,
          color: "#f59e0b"
        };
      }
    }

    return {
      success: true,
      optionId: option.id,
      name: option.name,
      badge: option.badge,
      lineName: option.lineName,
      directionText: option.directionText,
      stopName: option.stopName,
      destStopName: option.destStopName,
      totalTripTime: option.totalTripTime,
      prepTimeMinutes: option.prepTimeMinutes,
      nextBus,
      secondBus,
      depDesc: raw.depDesc || "",
      decision,
    };
  } catch (err) {
    return {
      success: false,
      optionId: option.id,
      name: option.name,
      error: err.message
    };
  }
}
