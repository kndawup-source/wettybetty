import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function json(res, status, data) {
  return res.status(status).json(data);
}

function hashPin(pin) {
  return crypto
    .createHash("sha256")
    .update(String(pin) + process.env.PIN_SECRET)
    .digest("hex");
}

export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method !== "POST") {
    return json(res, 405, { ok: false, message: "POST만 허용됩니다." });
  }

  try {
    const { phone_last4, pin } = req.body || {};

    const cleanPhone = String(phone_last4 || "").replace(/\D/g, "");
    const cleanPin = String(pin || "").replace(/\D/g, "");

    if (cleanPhone.length !== 4) {
      return json(res, 400, { ok: false, message: "전화번호 뒷자리 4자리가 필요합니다." });
    }

    if (cleanPin.length < 4 || cleanPin.length > 6) {
      return json(res, 400, { ok: false, message: "PIN은 4~6자리여야 합니다." });
    }

    const pinHash = hashPin(cleanPin);

    const { data: user, error } = await supabase
      .from("wetty_users")
      .select("id,nickname,points,hit_count,vote_count,streak,referral_code,pin_hash")
      .eq("phone_last4", cleanPhone)
      .maybeSingle();

    if (error) throw error;

    if (!user || user.pin_hash !== pinHash) {
      return json(res, 401, {
        ok: false,
        message: "전화번호 뒷자리 또는 PIN이 올바르지 않습니다."
      });
    }

    const { data: updated, error: updateError } = await supabase
      .from("wetty_users")
      .update({
        last_login_at: new Date().toISOString()
      })
      .eq("id", user.id)
      .select("id,nickname,points,hit_count,vote_count,streak,referral_code,last_login_at")
      .single();

    if (updateError) throw updateError;

    return json(res, 200, {
      ok: true,
      user: updated
    });
  } catch (error) {
    console.error(error);
    return json(res, 500, {
      ok: false,
      message: "로그인 처리 중 오류가 발생했습니다."
    });
  }
}