import {
  supabase,
  json,
  nowISO,
  getUserById,
  getPrediction
} from "./_lib.js";

export default async function handler(req, res){
  res.setHeader("Content-Type","application/json; charset=utf-8");

  if(req.method !== "POST"){
    return json(res,405,{
      ok:false,
      message:"METHOD_NOT_ALLOWED"
    });
  }

  try{
    const userId = req.headers["x-user-id"];

    if(!userId){
      return json(res,401,{
        ok:false,
        message:"UNAUTHORIZED"
      });
    }

    const body = req.body || {};

    const predictionId = String(body.prediction_id || "").trim();
    const choice = String(body.choice || "").trim();
    const points = Number(body.points || 100);

    if(!predictionId){
      return json(res,400,{
        ok:false,
        message:"INVALID_PREDICTION"
      });
    }

    if(choice !== "yes" && choice !== "no"){
      return json(res,400,{
        ok:false,
        message:"INVALID_CHOICE"
      });
    }

    const user = await getUserById(userId);

    if(!user){
      return json(res,404,{
        ok:false,
        message:"USER_NOT_FOUND"
      });
    }

    const prediction = await getPrediction(predictionId);

    if(!prediction){
      return json(res,404,{
        ok:false,
        message:"PREDICTION_NOT_FOUND"
      });
    }

    if(prediction.status !== "open"){
      return json(res,400,{
        ok:false,
        message:"이미 종료된 예측입니다"
      });
    }

    if(
      new Date(prediction.close_time).getTime() <= Date.now()
    ){
      return json(res,400,{
        ok:false,
        message:"마감된 예측입니다"
      });
    }

    const { data: alreadyVote } = await supabase
      .from("wetty_votes")
      .select("id")
      .eq("prediction_id", predictionId)
      .eq("user_id", userId)
      .maybeSingle();

    if(alreadyVote){
      return json(res,409,{
        ok:false,
        message:"이미 참여한 예측입니다"
      });
    }

    if(Number(user.points || 0) < points){
      return json(res,400,{
        ok:false,
        message:"포인트가 부족합니다"
      });
    }

    const { error: voteError } = await supabase
      .from("wetty_votes")
      .insert({
        prediction_id: predictionId,
        user_id: userId,
        choice,
        points,
        created_at: nowISO()
      });

    if(voteError){
      console.error(voteError);

      return json(res,500,{
        ok:false,
        message:"VOTE_INSERT_FAILED"
      });
    }

    let yesStake = Number(prediction.yes_stake || 0);
    let noStake = Number(prediction.no_stake || 0);

    if(choice === "yes"){
      yesStake += points;
    }else{
      noStake += points;
    }

    const totalStake = yesStake + noStake;

    const yesPercent = totalStake > 0
      ? Math.round((yesStake / totalStake) * 100)
      : 50;

    const noPercent = 100 - yesPercent;

    await supabase
      .from("wetty_predictions")
      .update({
        yes_stake: yesStake,
        no_stake: noStake,
        yes_percent: yesPercent,
        no_percent: noPercent,
        total_points: Number(prediction.total_points || 0) + points
      })
      .eq("id", predictionId);

    await supabase
      .from("wetty_users")
      .update({
        points: Number(user.points || 0) - points,
        vote_count: Number(user.vote_count || 0) + 1,
        updated_at: nowISO()
      })
      .eq("id", userId);

    return json(res,200,{
      ok:true
    });

  }catch(err){
    console.error(err);

    return json(res,500,{
      ok:false,
      message:"SERVER_ERROR"
    });
  }
}