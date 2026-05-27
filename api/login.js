import {
  supabase,
  json,
  comparePin,
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
        message:"PIN 형식을 확인해주세요"
      });
    }

    const { data:user, error } = await supabase
      .from("wetty_users")
      .select("*")
      .eq("phone_last4", phone)
      .maybeSingle();

    if(error){
      console.error(error);

      return json(res,500,{
        ok:false,
        message:"LOGIN_ERROR"
      });
    }

    if(!user){
      return json(res,401,{
        ok:false,
        message:"전화번호 또는 PIN이 올바르지 않습니다"
      });
    }

    const ok = await comparePin(pin, user.pin_hash);

    if(!ok){
      return json(res,401,{
        ok:false,
        message:"전화번호 또는 PIN이 올바르지 않습니다"
      });
    }

    await supabase
      .from("wetty_users")
      .update({
        updated_at:new Date().toISOString()
      })
      .eq("id", user.id);

    return json(res,200,{
      ok:true,
      user
    });

  }catch(err){
    console.error(err);

    return json(res,500,{
      ok:false,
      message:"SERVER_ERROR"
    });
  }
}