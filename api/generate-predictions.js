import { createClient } from "@supabase/supabase-js";

export const config = {
  runtime: "nodejs"
};

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const REGIONS = [
  { region: "서울", lat: 37.5665, lon: 126.9780 },
  { region: "부산", lat: 35.1796, lon: 129.0756 },
  { region: "대구", lat: 35.8714, lon: 128.6014 },
  { region: "인천", lat: 37.4563, lon: 126.7052 },
  { region: "광주", lat: 35.1595, lon: 126.8526 },
  { region: "대전", lat: 36.3504, lon: 127.3845 },
  { region: "제주", lat: 33.4996, lon: 126.5312 }
];

function json(res, status, data) {
  return res.status(status).json(data);
}

function pad(n) {
  return String(n).padStart(2, "0");
}

function kstNow() {
  return new Date(Date.now() + 9 * 60 * 60 * 1000);
}

function kstDateString(d = kstNow()) {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

function makeKstIso(dateStr, hour, minute = 0) {
  return new Date(`${dateStr}T${pad(hour)}:${pad(minute)}:00+09:00`).toISOString();
}

function getDayType(dateStr, isHoliday) {
  const d = new Date(`${dateStr}T00:00:00+09:00`);
  const day = d.getDay();

  if (isHoliday) return "holiday";
  if (day === 0 || day === 6) return "weekend";
  return "weekday";
}

function getTemplates(dayType) {
  if (dayType === "holiday") {
    return [
      {
        timeSlot: "holiday_morning",
        openHour: 8,
        closeHour: 10,
        targetHour: 12,
        title: "오늘 오전 외출길, 비 올까?",
        category: "rain",
        threshold: 0.1,
        priority: 80
      },
      {
        timeSlot: "holiday_lunch",
        openHour: 11,
        closeHour: 13,
        targetHour: 15,
        title: "오늘 나들이 시간에 비 올까?",
        category: "rain",
        threshold: 0.1,
        priority: 90
      },
      {
        timeSlot: "holiday_evening",
        openHour: 15,
        closeHour: 17,
        targetHour: 19,
        title: "오늘 저녁 귀가길, 비 올까?",
        category: "rain",
        threshold: 0.1,
        priority: 85
      },
      {
        timeSlot: "holiday_night",
        openHour: 20,
        closeHour: 22,
        targetHour: 24,
        title: "오늘 밤 비 올까?",
        category: "rain",
        threshold: 0.1,
        priority: 70
      }
    ];
  }

  if (dayType === "weekend") {
    return [
      {
        timeSlot: "weekend_morning",
        openHour: 8,
        closeHour: 10,
        targetHour: 12,
        title: "오늘 오전 외출길, 비 올까?",
        category: "rain",
        threshold: 0.1,
        priority: 75
      },
      {
        timeSlot: "weekend_lunch",
        openHour: 11,
        closeHour: 13,
        targetHour: 15,
        title: "오늘 낮 나들이, 비 올까?",
        category: "rain",
        threshold: 0.1,
        priority: 90
      },
      {
        timeSlot: "weekend_evening",
        openHour: 15,
        closeHour: 17,
        targetHour: 19,
        title: "오늘 저녁 약속길, 비 올까?",
        category: "rain",
        threshold: 0.1,
        priority: 85
      },
      {
        timeSlot: "weekend_night",
        openHour: 20,
        closeHour: 22,
        targetHour: 24,
        title: "오늘 밤 비 올까?",
        category: "rain",
        threshold: 0.1,
        priority: 70
      }
    ];
  }

  return [
    {
      timeSlot: "weekday_morning",
      openHour: 6,
      closeHour: 8,
      targetHour: 9,
      title: "오늘 출근길, 비 올까?",
      category: "rain",
      threshold: 0.1,
      priority: 90
    },
    {
      timeSlot: "weekday_lunch",
      openHour: 10,
      closeHour: 12,
      targetHour: 13,
      title: "오늘 점심시간, 비 올까?",
      category: "rain",
      threshold: 0.1,
      priority: 80
    },
    {
      timeSlot: "weekday_evening",
      openHour: 15,
      closeHour: 17,
      targetHour: 19,
      title: "오늘 퇴근길, 비 올까?",
      category: "rain",
      threshold: 0.1,
      priority: 95
    },
    {
      timeSlot: "weekday_night",
      openHour: 20,
      closeHour: 22,
      targetHour: 24,
      title: "오늘 밤 비 올까?",
      category: "rain",
      threshold: 0.1,
      priority: 70
    }
  ];
}

function buildPredictionRows({ dateStr, dayType, templates }) {
  const now = Date.now();
  const rows = [];

  for (const region of REGIONS) {
    for (const t of templates) {
      const openTime = makeKstIso(dateStr, t.openHour);
      const closeTime = makeKstIso(dateStr, t.closeHour);
      const targetHour = t.targetHour >= 24 ? 23 : t.targetHour;
      const targetMinute = t.targetHour >= 24 ? 59 : 0;
      const targetTime = makeKstIso(dateStr, targetHour, targetMinute);

      if (new Date(closeTime).getTime() <= now) continue;

      rows.push({
        title: `${region.region} · ${t.title}`,
        region: region.region,
        lat: region.lat,
        lon: region.lon,
        category: t.category,
        status: "open",
        schedule_type: dayType,
        time_slot: t.timeSlot,
        open_time: openTime,
        close_time: closeTime,
        target_time: targetTime,
        rain_threshold_mm: t.threshold,
        official_forecast: "AUTO",
        priority: t.priority,
        auto_generated: true
      });
    }
  }

  return rows;
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

    const dateStr = String(req.query?.date || req.body?.date || kstDateString());

    const { data: holiday } = await supabase
      .from("holidays")
      .select("*")
      .eq("date", dateStr)
      .maybeSingle();

    const dayType = getDayType(dateStr, !!holiday);
    const templates = getTemplates(dayType);

    const rows = buildPredictionRows({
      dateStr,
      dayType,
      templates
    });

    if (!rows.length) {
      return json(res, 200, {
        ok: true,
        message: "생성할 예측이 없습니다. 이미 시간이 지났을 수 있습니다.",
        date: dateStr,
        scheduleType: dayType,
        count: 0
      });
    }

    const { data: existing, error: existingError } = await supabase
      .from("predictions")
      .select("id, region, time_slot, schedule_type, open_time")
      .gte("open_time", `${dateStr}T00:00:00+09:00`)
      .lte("open_time", `${dateStr}T23:59:59+09:00`);

    if (existingError) throw existingError;

    const existingKeys = new Set(
      (existing || []).map(p => `${p.region}_${p.time_slot}`)
    );

    const insertRows = rows.filter(row => {
      return !existingKeys.has(`${row.region}_${row.time_slot}`);
    });

    if (!insertRows.length) {
      return json(res, 200, {
        ok: true,
        message: "이미 오늘 예측이 생성되어 있습니다.",
        date: dateStr,
        scheduleType: dayType,
        count: 0
      });
    }

    const { data, error } = await supabase
      .from("predictions")
      .insert(insertRows)
      .select();

    if (error) throw error;

    return json(res, 200, {
      ok: true,
      message: `${dateStr} ${dayType} 예측 ${data.length}개 생성 완료`,
      date: dateStr,
      scheduleType: dayType,
      holiday: holiday?.name || null,
      count: data.length,
      predictions: data
    });
  } catch (e) {
    return json(res, 500, {
      ok: false,
      message: e.message || "예측 생성 실패"
    });
  }
}