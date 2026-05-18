import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

function todayKey(){
  const d = new Date();
  const korea = new Date(d.toLocaleString("en-US",{timeZone:"Asia/Seoul"}));
  const y = korea.getFullYear();
  const m = String(korea.getMonth()+1).padStart(2,"0");
  const day = String(korea.getDate()).padStart(2,"0");
  return `${y}-${m}-${day}`;
}

export default async function handler(req,res){
  if(req.method !== "POST") return res.status(405).json({ok:false,message:"Method not allowed"});

  try{
    const userId = req.headers["x-user-id"];
    if(!userId) return res.status(401).json({ok:false,message:"로그인이 필요합니다"});

    const checkin_date = todayKey();

    const {error: insertError} = await supabase
      .from("wetty_checkins")
      .insert({
        user_id:userId,
        checkin_date,
        points:100
      });

    if(insertError){
      if(insertError.code === "23505") return res.json({ok:false,message:"오늘은 이미 출석했습니다"});
      throw insertError;
    }

    const {data:user} = await supabase
      .from("wetty_users")
      .select("points,streak")
      .eq("id", userId)
      .maybeSingle();

    await supabase
      .from("wetty_users")
      .update({
        points:Number(user?.points || 0) + 100,
        streak:Number(user?.streak || 0) + 1,
        updated_at:new Date().toISOString()
      })
      .eq("id", userId);

    return res.json({ok:true,message:"출석 완료"});
  }catch(e){
    return res.status(500).json({ok:false,message:"출석 처리 오류",detail:e.message});
  }
}