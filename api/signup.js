import {
  supabase,
  json,
  nowISO,
  hashPin,
  createReferralCode,
  sanitizeNickname,
  isValidPhoneLast4,
  isValidPin
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
    const body = req.body || {};

    const nickname = sanitizeNickname(body.nickname || "WETTY");
    const phone = String(body.phone_last4 || "").trim();
    const pin = String(body.pin || "").trim();

    if(!isValidPhoneLast4(phone)){
      return json(res,400,{
        ok:false,
        message:"전화번호 뒷자리 4자리를 확인해주세요"
      });
    }

    if(!isValidPin(pin)){
      return json(res,400,{
        ok:false,
        message:"PIN은 4~6자리여야 합니다"
      });
    }

    const { data: exists } = await supabase
      .from("wetty_users")
      .select("id")
      .eq("phone_last4", phone)
      .maybeSingle();

    if(exists){
      return json(res,409,{
        ok:false,
        message:"이미 가입된 번호입니다"
      });
    }

    let referral = createReferralCode();

    for(let i=0;i<5;i++){
      const { data: refExists } = await supabase
        .from("wetty_users")
        .select("id")
        .eq("referral_code", referral)
        .maybeSingle();

      if(!refExists) break;

      referral = createReferralCode();
    }

    const insertData = {
      nickname,
      phone_last4: phone,
      pin_hash: hashPin(pin),
      points: 300,
      streak: 0,
      hit_count: 0,
      vote_count: 0,
      referral_code: referral,
      created_at: nowISO(),
      updated_at: nowISO()
    };

    const { data, error } = await supabase
      .from("wetty_users")
      .insert(insertData)
      .select("*")
      .single();

    if(error){
      console.error(error);

      return json(res,500,{
        ok:false,
        message:"회원가입 실패"
      });
    }

    return json(res,200,{
      ok:true,
      user:data
    });

  }catch(err){
    console.error(err);

    return json(res,500,{
      ok:false,
      message:"SERVER_ERROR"
    });
  }
}