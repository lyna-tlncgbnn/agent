import { z } from "zod";
import { AppError } from "../errors/app-error.js";

const weatherArgsSchema = z.object({
  query: z.string().min(1).max(120),
  days: z.coerce.number().int().min(1).max(3).default(1)
});

type WeatherCodeMap = Record<number, string>;

const weatherCodeText: WeatherCodeMap = {
  0: "晴",
  1: "大部晴",
  2: "局部多云",
  3: "阴",
  45: "雾",
  48: "冻雾",
  51: "毛毛雨",
  53: "小雨",
  55: "中雨",
  56: "冻毛毛雨",
  57: "冻毛毛雨",
  61: "小雨",
  63: "中雨",
  65: "大雨",
  66: "冻雨",
  67: "冻雨",
  71: "小雪",
  73: "中雪",
  75: "大雪",
  77: "冰粒",
  80: "阵雨",
  81: "阵雨",
  82: "强阵雨",
  85: "阵雪",
  86: "强阵雪",
  95: "雷暴",
  96: "雷暴伴冰雹",
  99: "雷暴伴冰雹"
};

type GeoSearchResponse = {
  results?: Array<{
    name?: string;
    country?: string;
    admin1?: string;
    latitude?: number;
    longitude?: number;
  }>;
};

type ForecastResponse = {
  timezone?: string;
  current?: {
    time?: string;
    temperature_2m?: number;
    apparent_temperature?: number;
    relative_humidity_2m?: number;
    precipitation?: number;
    weather_code?: number;
    wind_speed_10m?: number;
  };
};

export type GetWeatherArgs = z.infer<typeof weatherArgsSchema>;

export type GetWeatherResult = {
  provider: string;
  query: string;
  location: string;
  latitude: number;
  longitude: number;
  timezone: string;
  current: {
    time: string;
    weatherText: string;
    temperatureC: number | null;
    apparentTemperatureC: number | null;
    humidity: number | null;
    precipitationMm: number | null;
    windSpeedKmh: number | null;
  };
};

function toNumberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function weatherTextFromCode(code: number | null): string {
  if (code === null) return "未知";
  return weatherCodeText[code] || "未知";
}

function sanitizeQuery(query: string): string {
  let q = query.trim();
  q = q.replace(/[，。！？、,.!?]/g, " ");
  q = q.replace(/\s+/g, " ").trim();
  q = q.replace(/^的+|的+$/g, "").trim();

  const stopwords = new Set(["的", "天气", "气温", "温度", "今天", "明天", "后天", "现在", "当前"]);
  if (!q || stopwords.has(q)) return "";
  if (q.length <= 1 && !/^[a-z]{2,}$/i.test(q)) return "";

  return q;
}

function buildQueryCandidates(rawQuery: string): string[] {
  const query = sanitizeQuery(rawQuery);
  if (!query) return [];

  const candidates = new Set<string>();
  candidates.add(query);

  // Try Chinese location suffix variants if needed.
  if (query.endsWith("市") || query.endsWith("省") || query.endsWith("区") || query.endsWith("县")) {
    candidates.add(query.slice(0, -1));
  } else {
    candidates.add(`${query}市`);
  }

  return Array.from(candidates).filter((item) => item.length > 0);
}

export function parseGetWeatherArgs(input: unknown): GetWeatherArgs {
  return weatherArgsSchema.parse(input ?? {});
}

async function searchGeo(query: string): Promise<NonNullable<GeoSearchResponse["results"]>[number] | null> {
  const searchUrl = new URL("https://geocoding-api.open-meteo.com/v1/search");
  searchUrl.searchParams.set("name", query);
  searchUrl.searchParams.set("count", "1");
  searchUrl.searchParams.set("language", "zh");
  searchUrl.searchParams.set("format", "json");

  const searchRes = await fetch(searchUrl.toString(), { method: "GET" });
  if (!searchRes.ok) {
    throw new AppError("UPSTREAM_ERROR", "天气地点解析失败", { status: searchRes.status });
  }

  const geoData = (await searchRes.json()) as GeoSearchResponse;
  return geoData.results?.[0] ?? null;
}

export async function runGetWeather(args: GetWeatherArgs): Promise<{ text: string; data: GetWeatherResult }> {
  const candidates = buildQueryCandidates(args.query);
  if (candidates.length === 0) {
    throw new AppError("BAD_REQUEST", "天气地点不明确，请提供城市或地区名称");
  }

  let geo: NonNullable<GeoSearchResponse["results"]>[number] | null = null;
  let matchedQuery = candidates[0];

  for (const candidate of candidates) {
    geo = await searchGeo(candidate);
    if (geo?.latitude && geo?.longitude) {
      matchedQuery = candidate;
      break;
    }
  }

  if (!geo || typeof geo.latitude !== "number" || typeof geo.longitude !== "number") {
    throw new AppError("NOT_FOUND", `未找到地点：${args.query}`);
  }

  const forecastUrl = new URL("https://api.open-meteo.com/v1/forecast");
  forecastUrl.searchParams.set("latitude", String(geo.latitude));
  forecastUrl.searchParams.set("longitude", String(geo.longitude));
  forecastUrl.searchParams.set(
    "current",
    "temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,weather_code,wind_speed_10m"
  );
  forecastUrl.searchParams.set("timezone", "auto");
  forecastUrl.searchParams.set("forecast_days", String(args.days));

  const forecastRes = await fetch(forecastUrl.toString(), { method: "GET" });
  if (!forecastRes.ok) {
    throw new AppError("UPSTREAM_ERROR", "天气数据获取失败", { status: forecastRes.status });
  }

  const forecastData = (await forecastRes.json()) as ForecastResponse;
  const current = forecastData.current;
  if (!current) {
    throw new AppError("UPSTREAM_FORMAT_ERROR", "天气服务返回格式异常：缺少 current");
  }

  const weatherCode = toNumberOrNull(current.weather_code);
  const weatherText = weatherTextFromCode(weatherCode);

  const locationParts = [geo.country, geo.admin1, geo.name].filter((part): part is string => Boolean(part && part.trim()));
  const location = locationParts.join(" / ");

  const result: GetWeatherResult = {
    provider: "open-meteo",
    query: matchedQuery,
    location,
    latitude: geo.latitude,
    longitude: geo.longitude,
    timezone: forecastData.timezone || "auto",
    current: {
      time: typeof current.time === "string" ? current.time : new Date().toISOString(),
      weatherText,
      temperatureC: toNumberOrNull(current.temperature_2m),
      apparentTemperatureC: toNumberOrNull(current.apparent_temperature),
      humidity: toNumberOrNull(current.relative_humidity_2m),
      precipitationMm: toNumberOrNull(current.precipitation),
      windSpeedKmh: toNumberOrNull(current.wind_speed_10m)
    }
  };

  const text = [
    `地点：${result.location}`,
    `天气：${result.current.weatherText}`,
    `温度：${result.current.temperatureC ?? "未知"}°C`,
    `体感：${result.current.apparentTemperatureC ?? "未知"}°C`,
    `湿度：${result.current.humidity ?? "未知"}%`,
    `降水：${result.current.precipitationMm ?? "未知"} mm`,
    `风速：${result.current.windSpeedKmh ?? "未知"} km/h`,
    `时间：${result.current.time}`,
    `数据源：${result.provider}`
  ].join("\n");

  return { text, data: result };
}
