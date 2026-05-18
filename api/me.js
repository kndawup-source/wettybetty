import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export default async function handler(req,res){
  try{
    const userId = req.headers["x-user-id"];

    if(!userId) return res.status(401).json({ok:false,message:"로그인이 필요합니다"});

    const {data,error} = await supabase
      .from("wetty_users")
      .select("id,nickname,points,vote_count,hit_count,streak,referral_code")
      .eq("id", userId)
      .maybeSingle();

    if(error) throw error;
    if(!data) return res.status(404).json({ok:false,message:"사용자를 찾을 수 없습니다"});

    return res.json({ok:true,user:data});
  }catch(e){
    return res.status(500).json({ok:false,message:"사용자 조회 오류",detail:e.message});
  }
}