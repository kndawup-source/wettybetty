import { createClient } from "@supabase/supabase-js";

export const config = {
  runtime: "nodejs"
};

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function json(res, status, data) {
  return res.status(status).json(data);
}

function getKstYear() {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return kst.getUTCFullYear();
}

function normalizeItem(item) {
  const locdate = String(item.locdate || "");
  const name = String(item.dateName || "").trim();
  const isHoliday = String(item.isHoliday || "").toUpperCase() === "Y";

  if (locdate.length !== 8 || !name || !isHoliday) return null;

  return {
    date: `${locdate.slice(0, 4)}-${locdate.slice(4, 6)}-${locdate.slice(6, 8)}`,
    name,
    type: "holiday"
  };
}

function normalizeItems(rawItems) {
  if (!rawItems) return [];
  if (Array.isArray(rawItems)) return rawItems.map(normalizeItem).filter(Boolean);
  return [normalizeItem(rawItems)].filter(Boolean);
}

async function fetchHolidayMonth(year, month) {
  const serviceKey = process.env.KOREA_HOLIDAY_API_KEY;

  if (!serviceKey) {
    throw new Error("KOREA_HOLIDAY_API_KEY is missing");
  }

  const solYear = String(year);
  const solMonth = String(month).padStart(2, "0");

  const url = new URL(
    "https://apis.data.go.kr/B090041/openapi/service/SpcdeInfoService/getRestDeInfo"
  );

  url.searchParams.set("serviceKey", serviceKey);
  url.searchParams.set("solYear", solYear);
  url.searchParams.set("solMonth", solMonth);
  url.searchParams.set("_type", "json");
  url.searchParams.set("numOfRows", "100");

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: {
      Accept: "application/json"
    }
  });

  const text = await res.text();

  if (!res.ok) {
    throw new Error(`Holiday API HTTP ${res.status}: ${text.slice(0, 200)}`);
  }

  let data;

  try {
    data = JSON.parse(text);
  } catch (e) {
    throw new Error(`Holiday API JSON parse failed: ${text.slice(0, 200)}`);
  }

  const header = data?.response?.header;
  const resultCode = header?.resultCode;

  if (resultCode && resultCode !== "00") {
    throw new Error(header?.resultMsg || "Holiday API error");
  }

  const items = data?.response?.body?.items?.item;
  return normalizeItems(items);
}

async function fetchHolidayYear(year) {
  const results = [];

  for (let month = 1; month <= 12; month++) {
    const monthItems = await fetchHolidayMonth(year, month);
    results.push(...monthItems);
  }

  const map = new Map();

  results.forEach(item => {
    map.set(item.date, item);
  });

  return [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export default async function handler(req, res) {
  if (req.method !== "POST" && req.method !== "GET") {
    return json(res, 405, {
      ok: false,
      message: "GET or POST only"
    });
  }

  try {
    const adminKey = req.method === "POST" ? req.body?.adminKey : req.query?.adminKey;

    if (!process.env.ADMIN_KEY || adminKey !== process.env.ADMIN_KEY) {
      return json(res, 401, {
        ok: false,
        message: "관리자 인증 실패"
      });
    }

    const baseYear = Number(req.query?.year || req.body?.year || getKstYear());

    const years = [baseYear, baseYear + 1];

    let allHolidays = [];

    for (const year of years) {
      const holidays = await fetchHolidayYear(year);
      allHolidays.push(...holidays);
    }

    const uniqueMap = new Map();

    allHolidays.forEach(item => {
      uniqueMap.set(item.date, item);
    });

    allHolidays = [...uniqueMap.values()].sort((a, b) => a.date.localeCompare(b.date));

    if (!allHolidays.length) {
      return json(res, 200, {
        ok: true,
        message: "동기화할 공휴일이 없습니다.",
        count: 0,
        years,
        holidays: []
      });
    }

    const { data, error } = await supabase
      .from("holidays")
      .upsert(allHolidays, {
        onConflict: "date"
      })
      .select();

    if (error) {
      throw error;
    }

    return json(res, 200, {
      ok: true,
      message: `${years.join(", ")}년 공휴일 ${data?.length || allHolidays.length}개 동기화 완료`,
      count: data?.length || allHolidays.length,
      years,
      holidays: data || allHolidays
    });
  } catch (e) {
    return json(res, 500, {
      ok: false,
      message: e.message || "공휴일 동기화 실패"
    });
  }
}