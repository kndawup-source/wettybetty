import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";
import bcrypt from "bcryptjs";

export const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export function json(res,status,data){
  return res.status(status).json(data);
}

export function nowISO(){
  return new Date().toISOString();
}

export async function hashPin(pin){
  return await bcrypt.hash(String(pin),10);
}

export async function comparePin(pin,hash){
  return await bcrypt.compare(String(pin),String(hash));
}

export function sanitizeNickname(value){
  return String(value || "")
    .replace(/[^\w가-힣]/g,"")
    .trim()
    .slice(0,12) || "WETTY";
}

export function isValidPhoneLast4(value){
  return /^\d{4}$/.test(String(value || ""));
}

export function isValidPin(value){
  return /^\d{4,6}$/.test(String(value || ""));
}

export function createReferralCode(){
  return crypto
    .randomBytes(4)
    .toString("hex")
    .toUpperCase()
    .slice(0,6);
}