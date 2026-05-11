import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const REGIONS = [
  { name: "서울 · 강남역", lat: 37.4979, lon: 127.0276 },
  { name: "서울 · 성수동", lat: 37.5446, lon: 127.0557 },
  { name: "서울 · 잠실", lat: 37.5133, lon: 127.1002 },
  { name: "서울 · 홍대입구", lat: 37.5572, lon: 126.9245 },
  { name: "서울 · 여의도", lat: 37.5219, lon: 126.9245 },
  { name: "부산 · 해운대", lat: 35.1631, lon: 129.1635 },
  { name: "제주 · 제주공항", lat: 33.5104, lon: 126.4914 }
];

function addHours(h){
  return new Date(Date.now() + h * 60 * 60 * 1000).toISOString();
}

function marketByWeather(region, current, hourly){
  const temp = current.temperature_2m ?? 0;
  const wind = current.wind_speed_10m ?? 0;
  const rainProb = hourly.precipitation_probability?.[0] ?? 0;
  const precipitation = current.precipitation ?? 0;

  if(rainProb >= 60 || precipitation > 0){
    return {
      title: `${region.name.replace("서울 · ","")} 우산 없이 버틸 수 있을까`,
      category: "rain",
      official_forecast: `RAIN ${rainProb}%`,
      priority: rainProb >= 80 ? 100 : 80
    };
  }

  if(temp >= 30){
    return {
      title: `${region.name.replace("서울 · ","")} 지금 밖에 10분 이상 가능할까`,
      category: "heat",
      official_forecast: `HOT ${Math.round(temp)}°`,
      priority: 70
    };
  }

  if(wind >= 7){
    return {
      title: `${region.name.replace("서울 · ","")} 우산 뒤집힐 정도로 바람 셀까`,
      category: "wind",
      official_forecast: `WIND ${Math.round(wind)}m/s`,
      priority: 65
    };
  }

  return {
    title: `${region.name.replace("서울 · ","")} 오늘 비 올 분위기일까`,
    category: "rain",
    official_forecast: `CLEAR ${100 - rainProb}%`,
    priority: 40
  };
}

export default async function handler(req, res){
  try{
    const key = req.headers["x-cron-key"];
    if(process.env.CRON_SECRET && key !== process.env.CRON_SECRET){
      return res.status(401).json({ ok:false, message:"unauthorized" });
    }

    const created = [];

    for(const region of REGIONS){
      const url =
        `https://api.open-meteo.com/v1/forecast?latitude=${region.lat}&longitude=${region.lon}` +
        `&current=temperature_2m,precipitation,weather_code,wind_speed_10m` +
        `&hourly=precipitation_probability&timezone=Asia%2FSeoul`;

      const weather = await fetch(url).then(r=>r.json());
      const market = marketByWeather(region, weather.current || {}, weather.hourly || {});

      const { data: exists } = await supabase
        .from("predictions")
        .select("id")
        .eq("region", region.name)
        .eq("category", market.category)
        .gte("created_at", new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString())
        .limit(1);

      if(exists?.length) continue;

      const { data, error } = await supabase
        .from("predictions")
        .insert({
          title: market.title,
          region: region.name,
          market_label: "WEATHER PICK",
          official_forecast: market.official_forecast,
          target_time: addHours(3),
          close_time: addHours(2),
          status: "open",
          rain_threshold_mm: 0.1,
          lat: region.lat,
          lon: region.lon,
          category: market.category,
          priority: market.priority,
          auto_generated: true
        })
        .select()
        .single();

      if(error) throw error;
      created.push(data);
    }

    return res.json({ ok:true, created });
  }catch(e){
    return res.status(500).json({ ok:false, message:e.message });
  }
}