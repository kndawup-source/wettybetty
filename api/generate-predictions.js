import {
  supabase,
  json,
  nowISO
} from "./_lib.js";

const REGION_POOL = [
  { id:"gangnam", name:"서울 강남", lat:37.4979, lon:127.0276, weight:95, type:"business" },
  { id:"hongdae", name:"서울 홍대", lat:37.5563, lon:126.9236, weight:88, type:"hotplace" },
  { id:"seongsu", name:"서울 성수", lat:37.5446, lon:127.0557, weight:86, type:"hotplace" },
  { id:"yeouido", name:"서울 여의도", lat:37.5219, lon:126.9245, weight:84, type:"business" },
  { id:"jamsil", name:"서울 잠실", lat:37.5133, lon:127.1002, weight:82, type:"city" },
  { id:"incheon_airport", name:"인천공항", lat:37.4602, lon:126.4407, weight:90, type:"airport" },
  { id:"gimpo_airport", name:"김포공항", lat:37.5583, lon:126.7906, weight:78, type:"airport" },
  { id:"suwon", name:"수원", lat:37.2636, lon:127.0286, weight:72, type:"city" },
  { id:"bundang", name:"분당", lat:37.3827, lon:127.1189, weight:74, type:"city" },
  { id:"ilsan", name:"일산", lat:37.6584, lon:126.7712, weight:70, type:"city" },
  { id:"songdo", name:"인천 송도", lat:37.3826, lon:126.6430, weight:75, type:"city" },
  { id:"busan_haeundae", name:"부산 해운대", lat:35.1587, lon:129.1604, weight:88, type:"beach" },
  { id:"jeju", name:"제주", lat:33.4996, lon:126.5312, weight:92, type:"travel" },
  { id:"gangneung", name:"강릉", lat:37.7519, lon:128.8761, weight:80, type:"travel" },
  { id:"daegu", name:"대구 동성로", lat:35.8693, lon:128.5940, weight:78, type:"city" }
];

function pad2(n){
  return String(n).padStart(2,"0");
}

function addMinutes(date,min){
  return new Date(date.getTime() + min * 60000);
}

function timeLabel(date){
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

function getNextBettingWindow(now = new Date()){
  const base = new Date(now);
  base.setMinutes(0,0,0);

  const currentHour = base.getHours();
  const nextEvenHour = currentHour % 2 === 0
    ? currentHour + 2
    : currentHour + 1;

  const start = new Date(base);
  start.setHours(nextEvenHour,0,0,0);

  if(start <= now){
    start.setHours(start.getHours() + 2);
  }

  const end = addMinutes(start,120);
  const close = addMinutes(start,-30);
  const result = addMinutes(end,10);

  return {
    start,
    end,
    close,
    result,
    targetLabel:`${timeLabel(start)}~${timeLabel(end)}`
  };
}

async function fetchWeather(lat,lon){
  const url =
    `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${lat}&longitude=${lon}` +
    `&current=temperature_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m` +
    `&hourly=precipitation_probability,temperature_2m` +
    `&past_days=1&forecast_days=1&timezone=Asia%2FSeoul`;

  const res = await fetch(url);

  if(!res.ok){
    throw new Error("WEATHER_API_ERROR");
  }

  const json = await res.json();
  const c = json.current || {};
  const hourly = json.hourly || {};

  const probs = hourly.precipitation_probability || [];
  const temps = hourly.temperature_2m || [];

  const temp = Number(c.temperature_2m || 0);
  const yesterdayTemp = Number(temps[0] || temp);

  return {
    temp,
    feelsLike:Number(c.apparent_temperature || temp),
    precipitation:Number(c.precipitation || 0),
    code:Number(c.weather_code || 0),
    wind:Number(c.wind_speed_10m || 0),
    rainProb:Number(probs[0] || 0),
    tempDiff:Math.round(temp - yesterdayTemp)
  };
}

function hasWeatherIssue(w){
  return (
    w.rainProb >= 35 ||
    w.precipitation > 0 ||
    w.wind >= 8 ||
    Math.abs(w.tempDiff) >= 5 ||
    w.temp >= 30 ||
    w.temp <= 0
  );
}

function getModeBonus(region){
  const day = new Date().getDay();
  const weekend = day === 0 || day === 6;

  let bonus = 0;

  if(weekend){
    if(region.type === "travel") bonus += 28;
    if(region.type === "beach") bonus += 25;
    if(region.type === "airport") bonus += 20;
    if(region.type === "hotplace") bonus += 20;
  }else{
    if(region.type === "business") bonus += 24;
    if(region.type === "city") bonus += 16;
    if(region.type === "hotplace") bonus += 12;
  }

  return bonus;
}

function getWeatherScore(w,region){
  let score = region.weight + getModeBonus(region);

  if(w.rainProb >= 70) score += 45;
  else if(w.rainProb >= 35) score += 28;

  if(w.precipitation > 0) score += 40;
  if(w.wind >= 8) score += 24;
  if(Math.abs(w.tempDiff) >= 5) score += 22;
  if(w.temp >= 30) score += 20;
  if(w.temp <= 0) score += 20;

  return score;
}

function makePrediction(region,w,window){
  let title = `${region.name}, ${window.targetLabel} 비 올까?`;
  let yesLabel = "온다";
  let noLabel = "안 온다";
  let base = w.rainProb;

  if(w.wind >= 8){
    title = `${region.name}, ${window.targetLabel} 바람 강할까?`;
    yesLabel = "세다";
    noLabel = "약하다";
    base = w.wind * 8;
  }

  if(w.temp >= 30){
    title = `${region.name}, ${window.targetLabel} 덥게 느껴질까?`;
    yesLabel = "덥다";
    noLabel = "괜찮다";
    base = w.feelsLike * 2.4;
  }

  if(w.temp <= 0){
    title = `${region.name}, ${window.targetLabel} 춥게 느껴질까?`;
    yesLabel = "춥다";
    noLabel = "괜찮다";
    base = 70 - w.feelsLike * 2;
  }

  const yes = Math.max(5,Math.min(95,Math.round(base)));
  const no = 100 - yes;
  const score = getWeatherScore(w,region);

  return {
    id:`${region.id}_${window.start.getTime()}`,
    region_id:region.id,
    region_name:region.name,
    title,
    issue:"자동 날씨 이슈",
    yes_label:yesLabel,
    no_label:noLabel,
    yes_percent:yes,
    no_percent:no,
    yes_stake:yes * 180,
    no_stake:no * 120,
    total_points:score * 250,
    close_time:window.close.toISOString(),
    start_time:window.start.toISOString(),
    end_time:window.end.toISOString(),
    result_time:window.result.toISOString(),
    status:"open",
    created_at:nowISO(),
    updated_at:nowISO()
  };
}

export default async function handler(req,res){
  res.setHeader("Content-Type","application/json; charset=utf-8");

  try{
    const window = getNextBettingWindow();

    const predictionIds = REGION_POOL.map(region=>{
      return `${region.id}_${window.start.getTime()}`;
    });

    const { data:existingRows, error:existingError } = await supabase
      .from("wetty_predictions")
      .select("id")
      .in("id", predictionIds);

    if(existingError){
      console.error(existingError);

      return json(res,500,{
        ok:false,
        message:"EXISTING_CHECK_FAILED"
      });
    }

    const existingSet = new Set(
      (existingRows || []).map(row=>row.id)
    );

    const tasks = REGION_POOL
      .filter(region=>{
        const id = `${region.id}_${window.start.getTime()}`;
        return !existingSet.has(id);
      })
      .map(async region=>{
        try{
          const weather = await fetchWeather(region.lat,region.lon);

          if(!hasWeatherIssue(weather)){
            return null;
          }

          return makePrediction(region,weather,window);
        }catch(err){
          console.error(region.id,err);
          return null;
        }
      });

    const results = await Promise.all(tasks);

    let predictions = results
      .filter(Boolean)
      .sort((a,b)=>b.total_points-a.total_points)
      .slice(0,7);

    if(!predictions.length && !existingRows?.length){
      const fallbackRegion = REGION_POOL[0];
      const weather = await fetchWeather(fallbackRegion.lat,fallbackRegion.lon);
      predictions = [
        makePrediction(fallbackRegion,weather,window)
      ];
    }

    if(predictions.length){
      const { error:insertError } = await supabase
        .from("wetty_predictions")
        .upsert(predictions,{
          onConflict:"id"
        });

      if(insertError){
        console.error(insertError);

        return json(res,500,{
          ok:false,
          message:"PREDICTION_INSERT_FAILED"
        });
      }
    }

    return json(res,200,{
      ok:true,
      created:predictions.length
    });

  }catch(err){
    console.error(err);

    return json(res,500,{
      ok:false,
      message:"SERVER_ERROR"
    });
  }
}