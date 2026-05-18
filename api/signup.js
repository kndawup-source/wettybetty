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

function makeReferralCode() {
  return "WT" + Math.random().toString(36).slice(2, 8).toUpperCase();
}

export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method !== "POST") {
    return json(res, 405, { ok: false, message: "POST만 허용됩니다." });
  }

  try {
    const { nickname, phone_last4, pin } = req.body || {};

    const cleanPhone = String(phone_last4 || "").replace(/\D/g, "");
    const cleanPin = String(pin || "").replace(/\D/g, "");
    const cleanNickname = String(nickname || "WETTY").trim().slice(0, 12);

    if (cleanPhone.length !== 4) {
      return json(res, 400, { ok: false, message: "전화번호 뒷자리 4자리가 필요합니다." });
    }

    if (cleanPin.length < 4 || cleanPin.length > 6) {
      return json(res, 400, { ok: false, message: "PIN은 4~6자리여야 합니다." });
    }

    const pinHash = hashPin(cleanPin);

    const { data: exists, error: existsError } = await supabase
      .from("wetty_users")
      .select("id")
      .eq("phone_last4", cleanPhone)
      .maybeSingle();

    if (existsError) throw existsError;

    if (exists) {
      return json(res, 409, { ok: false, message: "이미 가입된 전화번호 뒷자리입니다." });
    }

    const { data, error } = await supabase
      .from("wetty_users")
      .insert({
        device_id: crypto.randomUUID(),
        nickname: cleanNickname,
        phone_last4: cleanPhone,
        pin_hash: pinHash,
        login_pin: null,
        is_guest: false,
        referral_code: makeReferralCode(),
        points: 0,
        last_login_at: new Date().toISOString()
      })
      .select("id,nickname,points,hit_count,vote_count,streak,referral_code,created_at,last_login_at")
      .single();

    if (error) throw error;

    return json(res, 200, {
      ok: true,
      user: data
    });
  } catch (error) {
    console.error(error);
    return json(res, 500, {
      ok: false,
      message: "가입 처리 중 오류가 발생했습니다."
    });
  }
}