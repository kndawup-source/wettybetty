export const config = {
  runtime: "nodejs"
};

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const MAX_OPEN = 35;
const MIN_OPEN = 16;
const CREATE_LIMIT = 12;
const BATCH_SIZE = 8;

const CORE_REGION_NAMES = [
  "서울 · 강남역",
  "서울 · 성수동",
  "서울 · 잠실",
  "서울 · 홍대입구",
  "서울 · 여의도",
  "서울 · 광화문",
  "경기 · 판교",
  "부산 · 해운대",
  "제주 · 제주공항"
];

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
  { country:"KR", name:"서울 · 이태원", short:"이태원", lat:37.5345, lon:126.9946, type:"night" },
  { country:"KR", name:"서울 · 명동", short:"명동", lat:37.5636, lon:126.9834, type:"street" },

  { country:"KR", name:"경기 · 성남시", short:"성남시", lat:37.4200, lon:127.1265, type:"commute" },
  { country:"KR", name:"경기 · 판교", short:"판교", lat:37.3947, lon:127.1112, type:"commute" },
  { country:"KR", name:"경기 · 분당 정자", short:"분당 정자", lat:37.3672, lon:127.1080, type:"street" },
  { country:"KR", name:"경기 · 일산 호수공원", short:"일산 호수공원", lat:37.6536, lon:126.7681, type:"river" },
  { country:"KR", name:"경기 · 수원 행궁동", short:"행궁동", lat:37.2819, lon:127.0143, type:"travel" },
  { country:"KR", name:"경기 · 하남 미사", short:"하남 미사", lat:37.5672, lon:127.1907, type:"river" },
  { country:"KR", name:"경기 · 용인 에버랜드", short:"에버랜드", lat:37.2946, lon:127.2022, type:"travel" },

  { country:"KR", name:"부산 · 해운대", short:"해운대", lat:35.1631, lon:129.1635, type:"beach" },
  { country:"KR", name:"부산 · 서면", short:"서면", lat:35.1577, lon:129.0592, type:"street" },
  { country:"KR", name:"대구 · 동성로", short:"동성로", lat:35.8693, lon:128.5956, type:"street" },
  { country:"KR", name:"대전 · 둔산동", short:"둔산동", lat:36.3510, lon:127.3774, type:"commute" },
  { country:"KR", name:"광주 · 충장로", short:"충장로", lat:35.1482, lon:126.9135, type:"street" },
  { country:"KR", name:"인천 · 송도", short:"송도", lat:37.3895, lon:126.6450, type:"wind" },
  { country:"KR", name:"인천 · 월미도", short:"월미도", lat:37.4750, lon:126.5962, type:"beach" },
  { country:"KR", name:"울산 · 삼산동", short:"삼산동", lat:35.5396, lon:129.3383, type:"street" },

  { country:"KR", name:"제주 · 제주공항", short:"제주공항", lat:33.5104, lon:126.4914, type:"travel" },
  { country:"KR", name:"제주 · 애월", short:"애월", lat:33.4627, lon:126.3100, type:"travel" },
  { country:"KR", name:"제주 · 성산일출봉", short:"성산일출봉", lat:33.4581, lon:126.9425, type:"travel" },
  { country:"KR", name:"강원 · 강릉 경포대", short:"경포대", lat:37.7956, lon:128.9070, type:"beach" },
  { country:"KR", name:"강원 · 속초해변", short:"속초해변", lat:38.1915, lon:128.6032, type:"beach" },
  { country:"KR", name:"전북 · 전주 한옥마을", short:"전주 한옥마을", lat:35.8150, lon:127.1530, type:"travel" },
  { country:"KR", name:"경북 · 경주 황리단길", short:"황리단길", lat:35.8370, lon:129.2106, type:"travel" },
  { country:"KR", name:"전남 · 여수 낭만포차", short:"여수 낭만포차", lat:34.7393, lon:127.7368, type:"night" },
  { country:"KR", name:"충남 · 대천해수욕장", short:"대천해수욕장", lat:36.3054, lon:126.5153, type:"beach" },
  { country:"KR", name:"경남 · 통영 동피랑", short:"동피랑", lat:34.8452, lon:128.4240, type:"travel" },

  { country:"JP", name:"일본 · 도쿄 시부야", short:"시부야", lat:35.6595, lon:139.7005, type:"street" },
  { country:"JP", name:"일본 · 오사카 난바", short:"난바", lat:34.6655, lon:135.5019, type:"street" },
  { country:"TH", name:"태국 · 방콕 아속", short:"방콕 아속", lat:13.7373, lon:100.5605, type:"travel" },
  { country:"US", name:"미국 · 뉴욕 맨해튼", short:"맨해튼", lat:40.7580, lon:-73.9855, type:"street" },
  { country:"GB", name:"영국 · 런던 소호", short:"런던 소호", lat:51.5136, lon:-0.1365, type:"street" },
  { country:"FR", name:"프랑스 · 파리 마레", short:"파리 마레", lat:48.8566, lon:2.3522, type:"street" }
];

function json(res, status, data){
  return res.status(status).json(data);
}

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

function timeLabel(hour){
  if(hour === 0) return "자정";
  if(hour < 12) return `오전 ${hour}시`;
  if(hour === 12) return "오후 12시";
  return `오후 ${hour - 12}시`;
}

function getTimeSlot(){
  const now = kstNow();
  const day = now.getDay();
  const hour = now.getHours();
  const isWeekend = day === 0 || day === 6;

  if(isWeekend && hour < 18){
    return {
      key:"weekend",
      label:"주말나들이",
      targetHour:18,
      closeHour:18,
      close_time:makeKstDate(18,0),
      target_time:makeKstDate(18,0)
    };
  }

  if(hour < 9){
    return {
      key:"morning",
      label:"출근길",
      targetHour:9,
      closeHour:9,
      close_time:makeKstDate(9,0),
      target_time:makeKstDate(9,0)
    };
  }

  if(hour < 14){
    return {
      key:"lunch",
      label:"점심시간",
      targetHour:14,
      closeHour:14,
      close_time:makeKstDate(14,0),
      target_time:makeKstDate(14,0)
    };
  }

  if(hour < 20){
    return {
      key:"evening",
      label:"퇴근길",
      targetHour:20,
      closeHour:20,
      close_time:makeKstDate(20,0),
      target_time:makeKstDate(20,0)
    };
  }

  if(hour < 23){
    return {
      key:"night",
      label:"밤외출",
      targetHour:23,
      closeHour:23,
      close_time:makeKstDate(23,0),
      target_time:makeKstDate(23,0)
    };
  }

  return {
    key:"tomorrow_morning",
    label:"내일 출근길",
    targetHour:9,
    closeHour:9,
    close_time:makeKstDate(9,0,1),
    target_time:makeKstDate(9,0,1)
  };
}

function currentHourIndex(times = []){
  const now = new Date();
  let bestIndex = 0;
  let bestDiff = Infinity;

  for(let i = 0; i < times.length; i++){
    const diff = Math.abs(new Date(times[i]).getTime() - now.getTime());
    if(diff < bestDiff){
      bestDiff = diff;
      bestIndex = i;
    }
  }

  return bestIndex;
}

function titleFor(region, category, slot){
  const place = region.short;
  const t = timeLabel(slot.targetHour);

  if(category === "rain") return `${place} · ${t}까지 비 올까?`;
  if(category === "wind") return `${place} · ${t}까지 바람 셀까?`;
  if(category === "heat") return `${place} · ${t}까지 더울까?`;
  if(category === "cold") return `${place} · ${t}까지 추울까?`;
  if(category === "dust") return `${place} · ${t}까지 공기 안 좋을까?`;
  if(category === "humidity") return `${place} · ${t}까지 습할까?`;

  if(region.type === "beach") return `${place} · ${t}까지 바닷가 괜찮을까?`;
  if(region.type === "river") return `${place} · ${t}까지 한강 나가기 괜찮을까?`;
  if(region.type === "travel") return `${place} · ${t}까지 여행하기 괜찮을까?`;
  if(region.type === "night") return `${place} · ${t}까지 밤외출 괜찮을까?`;
  if(region.type === "commute") return `${place} · ${t}까지 이동 괜찮을까?`;

  return `${place} · ${t}까지 외출 괜찮을까?`;
}

async function fetchWeather(region){
  const weatherUrl =
    `https://api.open-meteo.com/v1/forecast?latitude=${region.lat}&longitude=${region.lon}` +
    `&current=temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,weather_code,wind_speed_10m` +
    `&hourly=precipitation_probability,temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,precipitation` +
    `&forecast_days=1&timezone=auto`;

  const airUrl =
    `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${region.lat}&longitude=${region.lon}` +
    `&hourly=pm10,pm2_5,dust&forecast_days=1&timezone=auto`;

  const [weatherRes, airRes] = await Promise.allSettled([
    fetch(weatherUrl, { cache:"no-store" }).then(r => r.json()),
    fetch(airUrl, { cache:"no-store" }).then(r => r.json())
  ]);

  return {
    weather: weatherRes.status === "fulfilled" ? weatherRes.value : { hourly:{}, current:{} },
    air: airRes.status === "fulfilled" ? airRes.value : { hourly:{} }
  };
}

function makeMarket(region, weather, air, slot){
  const current = weather.current || {};
  const hourly = weather.hourly || {};
  const airHourly = air.hourly || {};

  const idx = currentHourIndex(hourly.time || []);
  const airIdx = currentHourIndex(airHourly.time || []);

  const temp = Number(current.temperature_2m ?? 0);
  const feels = Number(current.apparent_temperature ?? temp);
  const wind = Number(current.wind_speed_10m ?? 0);
  const humidity = Number(current.relative_humidity_2m ?? 0);
  const precipitation = Number(current.precipitation ?? 0);
  const rainProb = Number(hourly.precipitation_probability?.[idx] ?? 0);

  const pm10 = Number(airHourly.pm10?.[airIdx] ?? 0);
  const pm25 = Number(airHourly.pm2_5?.[airIdx] ?? 0);
  const dust = Number(airHourly.dust?.[airIdx] ?? 0);

  const candidates = [];

  if(rainProb >= 55 || precipitation > 0){
    candidates.push({
      category:"rain",
      priority:rainProb >= 80 || precipitation > 0 ? 100 : 82,
      official_forecast:`비 가능성 ${rainProb}%`,
      issue:true
    });
  }

  if(pm25 >= 35 || pm10 >= 80 || dust >= 100){
    candidates.push({
      category:"dust",
      priority:pm25 >= 50 || pm10 >= 120 ? 92 : 78,
      official_forecast:`PM2.5 ${Math.round(pm25)} · PM10 ${Math.round(pm10)}`,
      issue:true
    });
  }

  if(wind >= 14){
    candidates.push({
      category:"wind",
      priority:95,
      official_forecast:`강풍 ${wind.toFixed(1)}m/s`,
      issue:true
    });
  }else if(wind >= 8){
    candidates.push({
      category:"wind",
      priority:75,
      official_forecast:`바람 ${wind.toFixed(1)}m/s`,
      issue:true
    });
  }

  if(feels >= 30){
    candidates.push({
      category:"heat",
      priority:72,
      official_forecast:`체감 ${Math.round(feels)}°`,
      issue:true
    });
  }

  if(feels <= 3){
    candidates.push({
      category:"cold",
      priority:72,
      official_forecast:`체감 ${Math.round(feels)}°`,
      issue:true
    });
  }

  if(humidity >= 80 && temp >= 24){
    candidates.push({
      category:"humidity",
      priority:62,
      official_forecast:`습도 ${Math.round(humidity)}%`,
      issue:true
    });
  }

  if(!candidates.length){
    const coreBonus = CORE_REGION_NAMES.includes(region.name) ? 20 : 0;

    candidates.push({
      category:"activity",
      priority:40 + coreBonus,
      official_forecast:`비 가능성 ${rainProb}% · 체감 ${Math.round(feels)}°`,
      issue:false
    });
  }

  candidates.sort((a,b) => b.priority - a.priority);
  const chosen = candidates[0];

  return {
    title:titleFor(region, chosen.category, slot),
    category:chosen.category,
    priority:chosen.priority,
    official_forecast:chosen.official_forecast,
    issue:chosen.issue
  };
}

async function fetchInBatches(items, batchSize, worker){
  const results = [];

  for(let i = 0; i < items.length; i += batchSize){
    const batch = items.slice(i, i + batchSize);
    const settled = await Promise.allSettled(batch.map(worker));

    for(const r of settled){
      if(r.status === "fulfilled") results.push(r.value);
    }
  }

  return results;
}

export default async function handler(req, res){
  if(req.method !== "GET" && req.method !== "POST"){
    return json(res, 405, {
      ok:false,
      message:"GET or POST only"
    });
  }

  try{
    const adminKey = req.method === "POST"
      ? req.body?.adminKey
      : req.query?.adminKey;

    if(!process.env.ADMIN_KEY || adminKey !== process.env.ADMIN_KEY){
      return json(res, 401, {
        ok:false,
        message:"관리자 인증 실패"
      });
    }

    const slot = getTimeSlot();

    const { data: openRows, error:openError } = await supabase
      .from("predictions")
      .select("id, region, category, close_time, target_time, time_slot, status")
      .eq("status", "open");

    if(openError) throw openError;

    const activeOpen = (openRows || []).filter(p =>
      new Date(p.close_time).getTime() > Date.now()
    );

    if(activeOpen.length >= MAX_OPEN){
      return json(res, 200, {
        ok:true,
        message:"열린 예측이 충분합니다.",
        open_count:activeOpen.length,
        created_count:0
      });
    }

    const existingKeys = new Set(
      activeOpen.map(p => `${p.region}_${p.time_slot}_${p.target_time}`)
    );

    const prepared = await fetchInBatches(REGIONS, BATCH_SIZE, async region => {
      const { weather, air } = await fetchWeather(region);
      const market = makeMarket(region, weather, air, slot);

      return {
        region,
        market
      };
    });

    const issueMarkets = prepared
      .filter(x => x.market.issue)
      .sort((a,b) => b.market.priority - a.market.priority);

    const fallbackMarkets = prepared
      .filter(x => !x.market.issue)
      .sort((a,b) => b.market.priority - a.market.priority);

    const neededByMinOpen = Math.max(0, MIN_OPEN - activeOpen.length);
    const available = Math.max(0, MAX_OPEN - activeOpen.length);
    const targetLimit = Math.min(
      Math.max(CREATE_LIMIT, neededByMinOpen),
      available
    );

    const selected = [
      ...issueMarkets,
      ...fallbackMarkets
    ].slice(0, targetLimit);

    const created = [];
    const skipped = [];

    for(const item of selected){
      const { region, market } = item;
      const key = `${region.name}_${slot.key}_${slot.target_time}`;

      if(existingKeys.has(key)){
        skipped.push(`${region.name}: already open`);
        continue;
      }

      const { data: alreadyExists, error:existsError } = await supabase
        .from("predictions")
        .select("id")
        .eq("region", region.name)
        .eq("time_slot", slot.key)
        .eq("target_time", slot.target_time)
        .maybeSingle();

      if(existsError){
        skipped.push(`${region.name}: ${existsError.message}`);
        continue;
      }

      if(alreadyExists){
        skipped.push(`${region.name}: already exists`);
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
          rain_threshold_mm:market.category === "rain" ? 0.1 : 0,
          lat:region.lat,
          lon:region.lon,
          category:market.category,
          priority:market.priority,
          auto_generated:true,
          time_slot:slot.key
        })
        .select()
        .single();

      if(error){
        skipped.push(`${region.name}: ${error.message}`);
        continue;
      }

      created.push(data);
      existingKeys.add(key);

      if(created.length >= targetLimit) break;
    }

    return json(res, 200, {
      ok:true,
      message:`신규 예측 ${created.length}개 생성 완료`,
      mode:"wide_pool_issue_first_with_fallback",
      time_slot:{
        key:slot.key,
        label:slot.label,
        close_label:timeLabel(slot.closeHour),
        target_label:timeLabel(slot.targetHour),
        close_time:slot.close_time,
        target_time:slot.target_time
      },
      total_regions:REGIONS.length,
      open_count:activeOpen.length,
      issue_candidates:issueMarkets.length,
      fallback_candidates:fallbackMarkets.length,
      selected_count:selected.length,
      created_count:created.length,
      skipped_count:skipped.length,
      skipped,
      created
    });

  }catch(e){
    return json(res, 500, {
      ok:false,
      message:e.message || "예측 생성 실패"
    });
  }
}