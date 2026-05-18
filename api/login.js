import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

function hashPin(pin){
  return crypto.createHmac("sha256", process.env.PIN_SECRET).update(String(pin)).digest("hex");
}

export default async function handler(req,res){
  if(req.method !== "POST") return res.status(405).json({ok:false,message:"Method not allowed"});

  try{
    const {phone_last4, pin} = req.body || {};

    if(!/^\d{4}$/.test(phone_last4)) return res.json({ok:false,message:"전화번호 뒷자리 4자리가 필요합니다"});
    if(!/^\d{4,6}$/.test(pin)) return res.json({ok:false,message:"PIN은 4~6자리입니다"});

    const {data, error} = await supabase
      .from("wetty_users")
      .select("id,nickname,points,vote_count,hit_count,streak,referral_code,pin_hash")
      .eq("phone_last4", phone_last4)
      .maybeSingle();

    if(error) throw error;
    if(!data) return res.json({ok:false,message:"계정을 찾을 수 없습니다"});

    if(data.pin_hash !== hashPin(pin)){
      return res.json({ok:false,message:"PIN이 맞지 않습니다"});
    }

    await supabase
      .from("wetty_users")
      .update({last_login_at:new Date().toISOString()})
      .eq("id", data.id);

    delete data.pin_hash;

    return res.json({ok:true,user:data});
  }catch(e){
    return res.status(500).json({ok:false,message:"로그인 오류",detail:e.message});
  }
}