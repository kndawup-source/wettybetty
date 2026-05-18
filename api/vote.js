import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export default async function handler(req,res){
  if(req.method !== "POST") return res.status(405).json({ok:false,message:"Method not allowed"});

  try{
    const userId = req.headers["x-user-id"];
    const {prediction_id, choice, points = 100} = req.body || {};

    if(!userId) return res.status(401).json({ok:false,message:"로그인이 필요합니다"});
    if(!prediction_id) return res.json({ok:false,message:"예측 ID가 필요합니다"});
    if(!["yes","no"].includes(choice)) return res.json({ok:false,message:"선택값이 올바르지 않습니다"});

    const {data: prediction, error: predError} = await supabase
      .from("wetty_predictions")
      .select("*")
      .eq("id", prediction_id)
      .maybeSingle();

    if(predError) throw predError;
    if(!prediction) return res.json({ok:false,message:"예측을 찾을 수 없습니다"});

    if(new Date(prediction.close_time).getTime() <= Date.now()){
      return res.json({ok:false,message:"이미 마감된 예측입니다"});
    }

    const {error: voteError} = await supabase
      .from("wetty_votes")
      .insert({
        prediction_id,
        user_id:userId,
        choice,
        points
      });

    if(voteError){
      if(voteError.code === "23505") return res.json({ok:false,message:"이미 참여한 예측입니다"});
      throw voteError;
    }

    const yesStake = Number(prediction.yes_stake || 0) + (choice === "yes" ? Number(points) : 0);
    const noStake = Number(prediction.no_stake || 0) + (choice === "no" ? Number(points) : 0);
    const total = yesStake + noStake;
    const yesPercent = total > 0 ? Math.round((yesStake / total) * 100) : prediction.yes_percent;
    const noPercent = 100 - yesPercent;

    await supabase
      .from("wetty_predictions")
      .update({
        yes_stake: yesStake,
        no_stake: noStake,
        total_points: total,
        yes_percent: yesPercent,
        no_percent: noPercent
      })
      .eq("id", prediction_id);

    const {data:user} = await supabase
      .from("wetty_users")
      .select("points,vote_count")
      .eq("id", userId)
      .maybeSingle();

    await supabase
      .from("wetty_users")
      .update({
        points: Number(user?.points || 0) + 10,
        vote_count: Number(user?.vote_count || 0) + 1,
        updated_at: new Date().toISOString()
      })
      .eq("id", userId);

    return res.json({ok:true,message:"참여 완료"});
  }catch(e){
    return res.status(500).json({ok:false,message:"투표 처리 오류",detail:e.message});
  }
}