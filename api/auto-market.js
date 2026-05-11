import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const REGIONS = [
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

  { country:"KR", name:"부산 · 해운대", short:"해운대", lat:35.1631, lon:129.1635, type:"beach" },
  { country:"KR", name:"부산 · 서면", short:"서면", lat:35.1577, lon:129.0592, type:"street" },
  { country:"KR", name:"대구 · 동성로", short:"동성로", lat:35.8693, lon:128.5956, type:"street" },
  { country:"KR", name:"대전 · 둔산동", short:"둔산동", lat:36.3510, lon:127.3774, type:"commute" },
  { country:"KR", name:"광주 · 충장로", short:"충장로", lat:35.1482, lon:126.9135, type:"street" },
  { country:"KR", name:"인천 · 송도", short:"송도", lat:37.3895, lon:126.6450, type:"wind" },
  { country:"KR", name:"울산 · 삼산동", short:"삼산동", lat:35.5396, lon:129.3383, type:"street" },

  { country:"KR", name:"제주 · 제주공항", short:"제주공항", lat:33.5104, lon:126.4914, type:"travel" },
  { country:"KR", name:"제주 · 애월", short:"애월", lat:33.4627, lon:126.3100, type:"travel" },
  { country:"KR", name:"강릉 · 경포대", short:"경포대", lat:37.7956, lon:128.9070, type:"beach" },
  { country:"KR", name:"속초 · 속초해변", short:"속초해변", lat:38.1915, lon:128.6032, type:"beach" },
  { country:"KR", name:"전주 · 한옥마을", short:"전주 한옥마을", lat:35.8150, lon:127.1530, type:"travel" },
  { country:"KR", name:"경주 · 황리단길", short:"황리단길", lat:35.8370, lon:129.2106, type:"travel" },

  { country:"JP", name:"일본 · 도쿄 시부야", short:"시부야", lat:35.6595, lon:139.7005, type:"street" },
  { country:"JP", name:"일본 · 오사카 난바", short:"난바", lat:34.6655, lon:135.5019, type:"street" },
  { country:"TH", name:"태국 · 방콕 아속", short:"방콕 아속", lat:13.7373, lon:100.5605, type:"travel" },
  { country:"US", name:"미국 · 뉴욕 맨해튼", short:"맨해튼", lat:40.7580, lon:-73.9855, type:"street" },
  { country:"GB", name:"영국 · 런던 소호", short:"런던 소호", lat:51.5136, lon:-0.1365, type:"street" },
  { country:"FR", name:"프랑스 · 파리 마레", short:"파리 마레", lat:48.8566, lon:2.3522, type:"street" }
];

function kstNow(){
  return new Date(new Date().toLocaleString("en-US", { timeZone:"Asia/Seoul" }));
}

function makeKstDate(hour, minute = 0, addDays = 0){
  const now = kstNow();
  const d = new Date(now);
  d.setDate(d.getDate() + addDays);
  d.setHours(hour, minute, 0, 0);
  return new Date(d.getTime() - 9 * 60 * 60 * 1000).toISOString();
}

function getTimeSlot(){
  const now = kstNow();
  const day = now.getDay();
  const hour = now.getHours();
  const isWeekend = day === 0 || day === 6;

  if(isWeekend && hour < 16){
    return {
      key:"weekend",
      label:"주말나들이",
      close_time:makeKstDate(10, 0),
      target_time:makeKstDate(18, 0)
    };
  }

  if(hour < 9){
    return {
      key:"morning",
      label:"출근길",
      close_time:makeKstDate(7, 0),
      target_time:makeKstDate(9, 0)
    };
  }

  if(hour < 14){
    return {
      key:"lunch",
      label:"점심시간",
      close_time:makeKstDate(12, 0),
      target_time:makeKstDate(14, 0)
    };
  }

  if(hour < 20){
    return {
      key:"evening",
      label:"퇴근길",
      close_time:makeKstDate(17, 0),
      target_time:makeKstDate(20, 0)
    };
  }

  if(hour < 23){
    return {
      key:"night",
      label:"밤외출",
      close_time:makeKstDate(20, 0),
      target_time:makeKstDate(23, 0)
    };
  }

  return {
    key:"morning",
    label:"내일 출근길",
    close_time:makeKstDate(7, 0, 1),
    target_time:makeKstDate(9, 0, 1)
  };
}

function currentHourIndex(times = []){
  const nowHour = new Date().getHours();

  for(let i = 0; i < times.length; i++){
    if(new Date(times[i]).getHours() === nowHour) return i;
  }

  return 0;
}

function titleFor(region, category, slot){
  const p = region.short;
  const s = slot.label;

  if(category === "rain"){
    if(slot.key === "morning") return `${p} 출근길, 우산 필요할까?`;
    if(slot.key === "evening") return `${p} 퇴근길, 우산 챙겨야 할까?`;
    if(slot.key === "lunch") return `${p} 점심시간, 비 피할 수 있을까?`;
    if(slot.key === "night") return `${p} 오늘 밤, 비 맞을까?`;
    if(slot.key === "weekend") return `${p} 주말나들이, 비 피할 수 있을까?`;
    return `${p} ${s}, 우산 필요할까?`;
  }

  if(category === "dust"){
    if(slot.key === "morning") return `${p} 출근길, 마스크 필요할까?`;
    if(slot.key === "weekend") return `${p} 주말 외출, 공기 괜찮을까?`;
    return `${p} ${s}, 마스크 없이 괜찮을까?`;
  }

  if(category === "heat"){
    if(slot.key === "evening") return `${p} 퇴근길, 더위 체감 심할까?`;
    if(slot.key === "weekend") return `${p} 주말나들이, 더위 괜찮을까?`;
    return `${p} ${s}, 밖에 오래 있기 힘들까?`;
  }

  if(category === "cold"){
    if(slot.key === "morning") return `${p} 출근길, 겉옷 필요할까?`;
    if(slot.key === "night") return `${p} 밤외출, 얇게 입으면 후회할까?`;
    return `${p} ${s}, 생각보다 추울까?`;
  }

  if(category === "wind"){
    if(region.type === "river") return `${p} ${s}, 바람 많이 불까?`;
    if(region.type === "beach") return `${p} ${s}, 바닷바람 셀까?`;
    return `${p} ${s}, 바람 때문에 불편할까?`;
  }

  if(category === "humidity"){
    return `${p} ${s}, 습해서 불쾌할까?`;
  }

  return `${p} ${s}, 밖에 나가기 괜찮을까?`;
}

function makeMarket(region, weather, air, slot){
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
    title:titleFor(region, chosen.category, slot),
    category:chosen.category,
    official_forecast:chosen.official_forecast,
    priority:chosen.priority,
    rain_threshold_mm:chosen.threshold
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
    const slot = getTimeSlot();
    const prepared = [];

    const results = await Promise.allSettled(
      REGIONS.map(async region => {
        const { weather, air } = await fetchWeather(region);
        const market = makeMarket(region, weather, air, slot);
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
        .eq("time_slot", slot.key)
        .gte("created_at", new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString())
        .limit(1);

      if(exists?.length){
        skipped.push(region.name);
        continue;
      }

      const { data, error } = await supabase
        .from("predictions")
        .insert({
          title:market.title,
          region:region.name,
          country:region.country,
          market_label:slot.label,
          official_forecast:market.official_forecast,
          target_time:slot.target_time,
          close_time:slot.close_time,
          status:"open",
          result:null,
          rain_threshold_mm:market.rain_threshold_mm,
          lat:region.lat,
          lon:region.lon,
          category:market.category,
          priority:market.priority,
          auto_generated:true,
          time_slot:slot.key
        })
        .select()
        .single();

      if(error) throw error;
      created.push(data);
    }

    return res.status(200).json({
      ok:true,
      time_slot:slot,
      created_count:created.length,
      skipped_count:skipped.length,
      created
    });

  }catch(e){
    return res.status(500).json({
      ok:false,
      message:e.message
    });
  }
}