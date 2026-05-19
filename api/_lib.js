import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

export const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export function json(res, status, data){
  res.status(status).json(data);
}

export function nowISO(){
  return new Date().toISOString();
}

export function hashPin(pin){
  return crypto
    .createHash("sha256")
    .update(String(pin))
    .digest("hex");
}

export function createReferralCode(){
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";

  for(let i=0;i<6;i++){
    out += chars[Math.floor(Math.random()*chars.length)];
  }

  return out;
}

export function sanitizeNickname(name=""){
  return String(name)
    .replace(/[^\w가-힣]/g,"")
    .slice(0,12);
}

export function getClientIp(req){
  return (
    req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    req.socket?.remoteAddress ||
    "0.0.0.0"
  );
}

export function isValidPhoneLast4(v){
  return /^\d{4}$/.test(String(v||""));
}

export function isValidPin(v){
  return /^\d{4,6}$/.test(String(v||""));
}

export async function getUserById(id){
  const { data } = await supabase
    .from("wetty_users")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  return data;
}

export async function getPrediction(id){
  const { data } = await supabase
    .from("wetty_predictions")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  return data;
}