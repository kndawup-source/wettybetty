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

  { country:"KR", name:"부산 · 해운대", short:"해운대", lat:35.1631, lon:129.1635, type:"beach" },
  { country:"KR", name:"부산 · 서면", short:"서면", lat:35.1577, lon:129.0592, type:"street" },

  { country:"KR", name:"제주 · 애월", short:"애월", lat:33.4627, lon:126.3100, type:"travel" },

  { country:"JP", name:"일본 · 도쿄 시부야", short:"시부야", lat:35.6595, lon:139.7005, type:"street" },
  { country:"US", name:"미국 · 뉴욕 맨해튼", short:"맨해튼", lat:40.7580, lon:-73.9855, type:"street" }
];

function kstNow(){
  return new Date(
    new Date().toLocaleString("en-US", {
      timeZone:"Asia/Seoul"
    })
  );
}

function makeKstDate(hour, minute = 0, addDays = 0){
  const now = kstNow();

  const d = new Date(now);

  d.setDate(d.getDate() + addDays);
  d.setHours(hour, minute, 0, 0);

  return new Date(
    d.getTime() - 9 * 60 * 60 * 1000
  ).toISOString();
}

function getTimeSlot(){

  const now = kstNow();
  const day = now.getDay();
  const hour = now.getHours();

  const isWeekend =
    day === 0 || day === 6;

  if(isWeekend && hour < 16){
    return {
      key:"weekend",
      label:"주말나들이",
      close_time:makeKstDate(16,0),
      target_time:makeKstDate(18,0)
    };
  }

  if(hour < 7){
    return {
      key:"morning",
      label:"출근길",
      close_time:makeKstDate(7,0),
      target_time:makeKstDate(9,0)
    };
  }

  if(hour < 12){
    return {
      key:"lunch",
      label:"점심시간",
      close_time:makeKstDate(12,0),
      target_time:makeKstDate(14,0)
    };
  }

  if(hour < 17){
    return {
      key:"evening",
      label:"퇴근길",
      close_time:makeKstDate(17,0),
      target_time:makeKstDate(20,0)
    };
  }

  if(hour < 20){
    return {
      key:"night",
      label:"밤외출",
      close_time:makeKstDate(20,0),
      target_time:makeKstDate(23,0)
    };
  }

  return {
    key:"morning",
    label:"내일 출근길",
    close_time:makeKstDate(7,0,1),
    target_time:makeKstDate(9,0,1)
  };
}

function currentHourIndex(times = []){

  const now = new Date();

  let bestIndex = 0;
  let bestDiff = Infinity;

  for(let i = 0; i < times.length; i++){

    const diff = Math.abs(
      new Date(times[i]).getTime() - now.getTime()
    );

    if(diff < bestDiff){
      bestDiff = diff;
      bestIndex = i;
    }
  }

  return bestIndex;
}

function titleFor(region, category, slot){

  const p = region.short;

  if(category === "rain"){
    if(slot.key === "morning"){
      return `${p} 출근길, 우산 필요할까?`;
    }

    if(slot.key === "evening"){
      return `${p} 퇴근길, 우산 챙겨야 할까?`;
    }

    if(slot.key === "night"){
      return `${p} 오늘 밤, 비 맞을까?`;
    }

    return `${p} ${slot.label}, 비 올까?`;
  }

  if(category === "heat"){
    return `${p} ${slot.label}, 덥게 느껴질까?`;
  }

  if(category === "cold"){
    return `${p} ${slot.label}, 생각보다 추울까?`;
  }

  if(category === "wind"){
    return `${p} ${slot.label}, 바람 강할까?`;
  }

  if(category === "dust"){
    return `${p} ${slot.label}, 공기 안 좋을까?`;
  }

  return `${p} ${slot.label}, 외출 괜찮을까?`;
}

function makeMarket(region, weather, slot){

  const current = weather.current || {};
  const hourly = weather.hourly || {};

  const idx =
    currentHourIndex(hourly.time || []);

  const temp =
    Number(current.temperature_2m ?? 0);

  const feels =
    Number(current.apparent_temperature ?? temp);

  const wind =
    Number(current.wind_speed_10m ?? 0);

  const precipitation =
    Number(current.precipitation ?? 0);

  const rainProb =
    Number(
      hourly.precipitation_probability?.[idx] ?? 0
    );

  const candidates = [];

  if(rainProb >= 55 || precipitation > 0){
    candidates.push({
      category:"rain",
      priority:100,
      official_forecast:`비 가능성 ${rainProb}%`
    });
  }

  if(feels >= 30){
    candidates.push({
      category:"heat",
      priority:80,
      official_forecast:`체감 ${Math.round(feels)}°`
    });
  }

  if(feels <= 3){
    candidates.push({
      category:"cold",
      priority:80,
      official_forecast:`체감 ${Math.round(feels)}°`
    });
  }

  if(wind >= 8){
    candidates.push({
      category:"wind",
      priority:70,
      official_forecast:`바람 ${wind.toFixed(1)}m/s`
    });
  }

  if(!candidates.length){
    candidates.push({
      category:"activity",
      priority:40,
      official_forecast:`비 가능성 ${rainProb}%`
    });
  }

  candidates.sort((a,b)=>
    b.priority - a.priority
  );

  const chosen = candidates[0];

  return {
    title:titleFor(region, chosen.category, slot),
    category:chosen.category,
    priority:chosen.priority,
    official_forecast:chosen.official_forecast
  };
}

async function fetchWeather(region){

  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${region.lat}&longitude=${region.lon}` +
    `&current=temperature_2m,apparent_temperature,precipitation,wind_speed_10m` +
    `&hourly=precipitation_probability&timezone=auto`;

  return await fetch(url).then(r=>r.json());
}

export default async function handler(req, res){

  try{

    const slot = getTimeSlot();

    const results = await Promise.all(
      REGIONS.map(async region => {

        const weather =
          await fetchWeather(region);

        const market =
          makeMarket(region, weather, slot);

        return { region, market };
      })
    );

    results.sort((a,b)=>
      b.market.priority - a.market.priority
    );

    const targets = results.slice(0, 20);

    const created = [];

    for(const item of targets){

      const { region, market } = item;

      const { data:exists } = await supabase
        .from("predictions")
        .select("id")
        .eq("region", region.name)
        .eq("category", market.category)
        .eq("time_slot", slot.key)
        .gte(
          "created_at",
          new Date(
            Date.now() - 6 * 60 * 60 * 1000
          ).toISOString()
        )
        .limit(1);

      if(exists?.length){
        continue;
      }

      const { data, error } = await supabase
        .from("predictions")
        .insert({
          title:market.title,
          region:region.name,
          country:region.country,

          market_label:slot.label,

          official_forecast:
            market.official_forecast,

          target_time:slot.target_time,
          close_time:slot.close_time,

          status:"open",
          result:null,

          rain_threshold_mm:0.1,

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
        console.log(error);
        continue;
      }

      created.push(data);
    }

    return res.status(200).json({
      ok:true,
      created_count:created.length,
      created
    });

  }catch(e){

    return res.status(500).json({
      ok:false,
      message:e.message
    });
  }
}