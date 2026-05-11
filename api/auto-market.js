import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const REGIONS = [
  // 서울 주요 지역
  { country:"KR", name:"서울 · 강남역", short:"강남역", lat:37.4979, lon:127.0276, type:"commute" },
  { country:"KR", name:"서울 · 성수동", short:"성수동", lat:37.5446, lon:127.0557, type:"night" },
  { country:"KR", name:"서울 · 잠실", short:"잠실", lat:37.5133, lon:127.1002, type:"river" },
  { country:"KR", name:"서울 · 홍대입구", short:"홍대입구", lat:37.5572, lon:126.9245, type:"street" },
  { country:"KR", name:"서울 · 여의도", short:"여의도", lat:37.5219, lon:126.9245, type:"commute" },
  { country:"KR", name:"서울 · 광화문", short:"광화문", lat:37.5759, lon:126.9769, type:"commute" },
  { country:"KR", name:"서울 · 압구정", short:"압구정", lat:37.5271, lon:127.0286, type:"street" },
  { country:"KR", name:"서울 · 건대입구", short:"건대입구", lat:37.5404, lon:127.0692, type:"night" },
  { country:"KR", name:"서울 · 반포한강공원", short:"반포 한강", lat:37.5106, lon:126.9957, type:"river" },
  { country:"KR", name:"서울 · 뚝섬한강공원", short:"뚝섬 한강", lat:37.5294, lon:127.0698, type:"river" },

  // 5대 광역시 + 인천
  { country:"KR", name:"부산 · 해운대", short:"해운대", lat:35.1631, lon:129.1635, type:"beach" },
  { country:"KR", name:"부산 · 서면", short:"서면", lat:35.1577, lon:129.0592, type:"street" },
  { country:"KR", name:"대구 · 동성로", short:"동성로", lat:35.8693, lon:128.5956, type:"street" },
  { country:"KR", name:"대전 · 둔산동", short:"둔산동", lat:36.3510, lon:127.3774, type:"commute" },
  { country:"KR", name:"광주 · 충장로", short:"충장로", lat:35.1482, lon:126.9135, type:"street" },
  { country:"KR", name:"인천 · 송도", short:"송도", lat:37.3895, lon:126.6450, type:"wind" },
  { country:"KR", name:"울산 · 삼산동", short:"삼산동", lat:35.5396, lon:129.3383, type:"street" },

  // 관광지
  { country:"KR", name:"제주 · 제주공항", short:"제주공항", lat:33.5104, lon:126.4914, type:"travel" },
  { country:"KR", name:"제주 · 애월", short:"애월", lat:33.4627, lon:126.3100, type:"travel" },
  { country:"KR", name:"강릉 · 경포대", short:"경포대", lat:37.7956, lon:128.9070, type:"beach" },
  { country:"KR", name:"속초 · 속초해변", short:"속초해변", lat:38.1915, lon:128.6032, type:"beach" },
  { country:"KR", name:"전주 · 한옥마을", short:"전주 한옥마을", lat:35.8150, lon:127.1530, type:"travel" },
  { country:"KR", name:"경주 · 황리단길", short:"황리단길", lat:35.8370, lon:129.2106, type:"travel" },

  // 해외 주요 도시
  { country:"JP", name:"일본 · 도쿄 시부야", short:"시부야", lat:35.6595, lon:139.7005, type:"street" },
  { country:"JP", name:"일본 · 오사카 난바", short:"난바", lat:34.6655, lon:135.5019, type:"street" },
  { country:"TH", name:"태국 · 방콕 아속", short:"방콕 아속", lat:13.7373, lon:100.5605, type:"travel" },
  { country:"US", name:"미국 · 뉴욕 맨해튼", short:"맨해튼", lat:40.7580, lon:-73.9855, type:"street" },
  { country:"GB", name:"영국 · 런던 소호", short:"런던 소호", lat:51.5136, lon:-0.1365, type:"street" },
  { country:"FR", name:"프랑스 · 파리 마레", short:"파리 마레", lat:48.8566, lon:2.3522, type:"street" }
];

function addHours(h){
  return new Date(Date.now() + h * 60 * 60 * 1000).toISOString();
}

function currentHourIndex(times = []){
  const now = new Date();
  const nowHour = now.getHours();

  for(let i = 0; i < times.length; i++){
    if(new Date(times[i]).getHours() === nowHour) return i;
  }

  return 0;
}

function titleFor(region, category){
  const p = region.short;

  const titleMap = {
    rain: {
      commute: `${p} 퇴근길, 우산 필요할까?`,
      night: `${p} 오늘 밤, 비 맞을까?`,
      river: `${p} 한강 쪽, 비 피할 수 있을까?`,
      beach: `${p} 바닷가, 갑자기 쏟아질까?`,
      travel: `${p} 도착할 때 비 올까?`,
      street: `${p}, 우산 없이 버틸 수 있을까?`,
      wind: `${p}, 비바람 올까?`
    },
    dust: {
      default: `${p}, 마스크 없이 나가면 후회할까?`
    },
    heat: {
      commute: `${p} 퇴근길, 밖에 오래 있기 힘들까?`,
      river: `${p} 야외 산책, 더위 괜찮을까?`,
      beach: `${p} 바닷가, 더위 체감 심할까?`,
      travel: `${p}, 낮에 돌아다니기 힘들까?`,
      default: `${p}, 지금 밖에 10분 이상 가능할까?`
    },
    cold: {
      commute: `${p} 출퇴근길, 겉옷 필요할까?`,
      river: `${p} 산책, 추워서 포기할까?`,
      travel: `${p}, 얇게 입으면 후회할까?`,
      default: `${p}, 생각보다 추울까?`
    },
    wind: {
      river: `${p} 한강 쪽, 바람 많이 불까?`,
      beach: `${p} 바닷바람, 꽤 셀까?`,
      travel: `${p}, 이동할 때 바람 때문에 불편할까?`,
      default: `${p}, 우산 뒤집힐 정도로 바람 셀까?`
    },
    humidity: {
      default: `${p}, 습해서 불쾌할까?`
    },
    activity: {
      river: `${p} 야외활동, 오늘 가능할까?`,
      beach: `${p} 바깥 일정, 무리 없을까?`,
      travel: `${p}, 돌아다니기 괜찮을까?`,
      default: `${p}, 오늘 밖에 나가기 괜찮을까?`
    }
  };

  return titleMap[category]?.[region.type] || titleMap[category]?.default || `${p}, 오늘 날씨 괜찮을까?`;
}

function makeMarket(region, weather, air){
  const current = weather.current || {};
  const hourly = weather.hourly || {};
  const airHourly = air.hourly || {};

  const idx = currentHourIndex(hourly.time || []);
  const airIdx = currentHourIndex(airHourly.time || []);

  const temp = Number(current.temperature_2m ?? 0);
  const feels = Number(current.apparent_temperature ?? temp);
  const humidity = Number(current.relative_humidity_2m ?? 0);
  const wind = Number(current.wind_speed_10m ?? 0);
  const precipitation = Number(current.precipitation ?? 0);
  const rainProb = Number(hourly.precipitation_probability?.[idx] ?? 0);

  const pm10 = Number(airHourly.pm10?.[airIdx] ?? 0);
  const pm25 = Number(airHourly.pm2_5?.[airIdx] ?? 0);
  const dust = Number(airHourly.dust?.[airIdx] ?? 0);

  const candidates = [];

  if(rainProb >= 55 || precipitation > 0){
    candidates.push({
      category:"rain",
      priority: rainProb >= 80 || precipitation > 0 ? 100 : 82,
      official_forecast:`비 가능성 ${rainProb}%`,
      threshold:0.1
    });
  }

  if(pm25 >= 35 || pm10 >= 80 || dust >= 100){
    candidates.push({
      category:"dust",
      priority: pm25 >= 50 || pm10 >= 120 ? 96 : 78,
      official_forecast:`PM2.5 ${Math.round(pm25)} · PM10 ${Math.round(pm10)}`,
      threshold:0.1
    });
  }

  if(feels >= 30){
    candidates.push({
      category:"heat",
      priority: feels >= 35 ? 92 : 72,
      official_forecast:`체감 ${Math.round(feels)}°`,
      threshold:0.1
    });
  }

  if(feels <= 3){
    candidates.push({
      category:"cold",
      priority: feels <= -3 ? 90 : 70,
      official_forecast:`체감 ${Math.round(feels)}°`,
      threshold:0.1
    });
  }

  if(wind >= 7){
    candidates.push({
      category:"wind",
      priority: wind >= 10 ? 88 : 68,
      official_forecast:`바람 ${wind.toFixed(1)}m/s`,
      threshold:0.1
    });
  }

  if(humidity >= 80 && temp >= 24){
    candidates.push({
      category:"humidity",
      priority: 62,
      official_forecast:`습도 ${Math.round(humidity)}%`,
      threshold:0.1
    });
  }

  if(!candidates.length){
    candidates.push({
      category:"activity",
      priority: 40,
      official_forecast:`비 가능성 ${rainProb}%`,
      threshold:0.1
    });
  }

  candidates.sort((a,b)=>b.priority-a.priority);
  const chosen = candidates[0];

  return {
    title: titleFor(region, chosen.category),
    category: chosen.category,
    official_forecast: chosen.official_forecast,
    priority: chosen.priority,
    rain_threshold_mm: chosen.threshold
  };
}

async function fetchWeather(region){
  const weatherUrl =
    `https://api.open-meteo.com/v1/forecast?latitude=${region.lat}&longitude=${region.lon}` +
    `&current=temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,weather_code,wind_speed_10m` +
    `&hourly=precipitation_probability&timezone=auto`;

  const airUrl =
    `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${region.lat}&longitude=${region.lon}` +
    `&hourly=pm10,pm2_5,dust&timezone=auto`;

  const [weather, air] = await Promise.all([
    fetch(weatherUrl).then(r=>r.json()),
    fetch(airUrl).then(r=>r.json()).catch(()=>({ hourly:{} }))
  ]);

  return { weather, air };
}

export default async function handler(req, res){
  try{
    const auth = req.headers.authorization;
    const key = req.headers["x-cron-key"] || req.query.key;

    const prepared = [];

    const results = await Promise.allSettled(
      REGIONS.map(async region => {
        const { weather, air } = await fetchWeather(region);
        const market = makeMarket(region, weather, air);
        return { region, market };
      })
    );

    for(const r of results){
      if(r.status === "fulfilled") prepared.push(r.value);
    }

    prepared.sort((a,b)=>b.market.priority-a.market.priority);

    const targets = prepared.slice(0, 25);
    const created = [];
    const skipped = [];

    for(const item of targets){
      const { region, market } = item;

      const { data: exists } = await supabase
        .from("predictions")
        .select("id")
        .eq("region", region.name)
        .eq("category", market.category)
        .gte("created_at", new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString())
        .limit(1);

      if(exists?.length){
        skipped.push(region.name);
        continue;
      }

      const { data, error } = await supabase
        .from("predictions")
        .insert({
          title: market.title,
          region: region.name,
          country: region.country,
          market_label: "WEATHER PICK",
          official_forecast: market.official_forecast,
          target_time: addHours(3),
          close_time: addHours(2),
          status: "open",
          result: null,
          rain_threshold_mm: market.rain_threshold_mm,
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

    return res.json({
      ok:true,
      created_count: created.length,
      skipped_count: skipped.length,
      created
    });

  }catch(e){
    return res.status(500).json({
      ok:false,
      message:e.message
    });
  }
}