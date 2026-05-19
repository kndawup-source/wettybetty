import {
  supabase,
  json,
  nowISO
} from "./_lib.js";

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

  const current = json.current || {};
  const hourly = json.hourly || {};

  const probs = hourly.precipitation_probability || [];
  const temps = hourly.temperature_2m || [];

  const temp = Number(current.temperature_2m || 0);
  const yesterdayTemp = Number(temps[0] || temp);

  return {
    temp,
    feelsLike:Number(current.apparent_temperature || temp),
    precipitation:Number(current.precipitation || 0),
    wind:Number(current.wind_speed_10m || 0),
    rainProb:Number(probs[0] || 0),
    tempDiff:Math.round(temp - yesterdayTemp)
  };
}

function getRegionLatLon(regionId){
  const map = {
    gangnam:[37.4979,127.0276],
    hongdae:[37.5563,126.9236],
    seongsu:[37.5446,127.0557],
    yeouido:[37.5219,126.9245],
    jamsil:[37.5133,127.1002],
    incheon_airport:[37.4602,126.4407],
    gimpo_airport:[37.5583,126.7906],
    suwon:[37.2636,127.0286],
    bundang:[37.3827,127.1189],
    ilsan:[37.6584,126.7712],
    songdo:[37.3826,126.6430],
    busan_haeundae:[35.1587,129.1604],
    jeju:[33.4996,126.5312],
    gangneung:[37.7519,128.8761],
    daegu:[35.8693,128.5940]
  };

  return map[regionId] || [37.4979,127.0276];
}

function determineResult(prediction,weather){
  const title = String(prediction.title || "");

  if(title.includes("비")){
    return (
      weather.precipitation > 0 ||
      weather.rainProb >= 60
    ) ? "yes" : "no";
  }

  if(title.includes("바람")){
    return weather.wind >= 8
      ? "yes"
      : "no";
  }

  if(title.includes("덥")){
    return weather.feelsLike >= 30
      ? "yes"
      : "no";
  }

  if(title.includes("춥")){
    return weather.feelsLike <= 0
      ? "yes"
      : "no";
  }

  return weather.rainProb >= 50
    ? "yes"
    : "no";
}

export default async function handler(req,res){
  res.setHeader("Content-Type","application/json; charset=utf-8");

  try{
    const now = new Date().toISOString();

    const { data:targets, error:targetError } = await supabase
      .from("wetty_predictions")
      .select("*")
      .eq("status","open")
      .lte("result_time", now);

    if(targetError){
      console.error(targetError);

      return json(res,500,{
        ok:false,
        message:"TARGET_LOAD_FAILED"
      });
    }

    if(!targets?.length){
      return json(res,200,{
        ok:true,
        settled:0
      });
    }

    let settledCount = 0;

    for(const prediction of targets){

      try{

        const [lat,lon] = getRegionLatLon(
          prediction.region_id
        );

        const weather = await fetchWeather(lat,lon);

        const result = determineResult(
          prediction,
          weather
        );

        const { data:votes } = await supabase
          .from("wetty_votes")
          .select("*")
          .eq("prediction_id", prediction.id);

        const winners = (votes || []).filter(v=>{
          return v.choice === result;
        });

        for(const vote of winners){

          const reward = Number(vote.points || 0) * 2;

          const { data:user } = await supabase
            .from("wetty_users")
            .select("*")
            .eq("id", vote.user_id)
            .maybeSingle();

          if(!user) continue;

          await supabase
            .from("wetty_users")
            .update({
              points:Number(user.points || 0) + reward,
              hit_count:Number(user.hit_count || 0) + 1,
              streak:Number(user.streak || 0) + 1,
              updated_at:nowISO()
            })
            .eq("id", user.id);

        }

        const losers = (votes || []).filter(v=>{
          return v.choice !== result;
        });

        for(const vote of losers){

          const { data:user } = await supabase
            .from("wetty_users")
            .select("*")
            .eq("id", vote.user_id)
            .maybeSingle();

          if(!user) continue;

          await supabase
            .from("wetty_users")
            .update({
              streak:0,
              updated_at:nowISO()
            })
            .eq("id", user.id);

        }

        await supabase
          .from("wetty_predictions")
          .update({
            status:"settled",
            result_choice:result,
            settled_at:nowISO(),
            updated_at:nowISO()
          })
          .eq("id", prediction.id);

        settledCount++;

      }catch(err){
        console.error(
          "settle error:",
          prediction.id,
          err
        );
      }
    }

    return json(res,200,{
      ok:true,
      settled:settledCount
    });

  }catch(err){
    console.error(err);

    return json(res,500,{
      ok:false,
      message:"SERVER_ERROR"
    });
  }
}