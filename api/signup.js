import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

function hashPin(pin){
  return crypto.createHmac("sha256", process.env.PIN_SECRET).update(String(pin)).digest("hex");
}

function referral(){
  return "WT" + Math.random().toString(36).slice(2,8).toUpperCase();
}

export default async function handler(req,res){
  if(req.method !== "POST") return res.status(405).json({ok:false,message:"Method not allowed"});

  try{
    const {nickname, phone_last4, pin} = req.body || {};

    if(!/^\d{4}$/.test(phone_last4)) return res.json({ok:false,message:"전화번호 뒷자리 4자리가 필요합니다"});
    if(!/^\d{4,6}$/.test(pin)) return res.json({ok:false,message:"PIN은 4~6자리입니다"});

    const pin_hash = hashPin(pin);

    const {data: exists} = await supabase
      .from("wetty_users")
      .select("id")
      .eq("phone_last4", phone_last4)
      .maybeSingle();

    if(exists) return res.json({ok:false,message:"이미 가입된 번호입니다"});

    const {data, error} = await supabase
      .from("wetty_users")
      .insert({
        nickname: nickname || "WETTY",
        phone_last4,
        pin_hash,
        referral_code: referral(),
        points: 0,
        vote_count: 0,
        hit_count: 0,
        streak: 0
      })
      .select("id,nickname,points,vote_count,hit_count,streak,referral_code")
      .single();

    if(error) throw error;

    return res.json({ok:true,user:data});
  }catch(e){
    return res.status(500).json({ok:false,message:"가입 오류",detail:e.message});
  }
}