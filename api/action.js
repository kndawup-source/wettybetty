import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const BAD_WORDS = [
  "씨발","시발","ㅅㅂ","병신","ㅂㅅ","좆","개새","미친년","미친놈"
];

function cleanText(v, max = 200) {
  return String(v || "").trim().replace(/\s+/g, " ").slice(0, max);
}

function todayKST() {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10);
}

function hasBadWord(text) {
  const lower = String(text || "").toLowerCase();
  return BAD_WORDS.some(w => lower.includes(w));
}

async function logPoint(userKey, amount, reason) {
  await supabase.from("point_logs").insert({
    user_key: userKey,
    amount,
    reason
  });
}

async function getProfile(userKey) {
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_key", userKey)
    .maybeSingle();

  return data;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, message: "POST only" });
  }

  try {
    const body = req.body || {};
    const action = body.action;
    const userKey = cleanText(body.userKey, 80);

    if (!userKey) {
      return res.status(400).json({ ok: false, message: "userKey required" });
    }

    if (action === "create_profile") {
      const nickname = cleanText(body.nickname || "Player", 12);

      if (hasBadWord(nickname)) {
        return res.status(400).json({ ok: false, message: "사용할 수 없는 닉네임입니다." });
      }

      const referralCode = "WB" + Math.random().toString(36).slice(2, 8).toUpperCase();

      const { data, error } = await supabase
        .from("profiles")
        .insert({
          user_key: userKey,
          nickname,
          points: 100,
          referral_code: referralCode
        })
        .select()
        .single();

      if (error) throw error;

      await logPoint(userKey, 100, "WELCOME CREDIT");

      return res.json({ ok: true, message: "100 CREDIT 지급", profile: data });
    }

    const profile = await getProfile(userKey);

    if (!profile) {
      return res.status(404).json({ ok: false, message: "profile not found" });
    }

    if (action === "checkin") {
      const today = todayKST();

      if (profile.last_checkin_date === today) {
        return res.json({ ok: true, message: "오늘 이미 받았습니다." });
      }

      const reward = 5;

      await supabase
        .from("profiles")
        .update({
          points: profile.points + reward,
          streak: profile.streak + 1,
          last_checkin_date: today
        })
        .eq("user_key", userKey);

      await logPoint(userKey, reward, "DAILY CLAIM");

      return res.json({ ok: true, message: `DAILY +${reward} CREDIT` });
    }

    if (action === "vote") {
      const predictionId = body.predictionId;
      const choice = body.choice;
      const stake = Number(body.stake || 10);

      if (!["rain", "clear"].includes(choice)) {
        return res.status(400).json({ ok: false, message: "invalid choice" });
      }

      if (![10, 30, 50, 100].includes(stake)) {
        return res.status(400).json({ ok: false, message: "invalid stake" });
      }

      if (profile.points < stake) {
        return res.status(400).json({ ok: false, message: "CREDIT 부족" });
      }

      const { data: prediction } = await supabase
        .from("predictions")
        .select("*")
        .eq("id", predictionId)
        .maybeSingle();

      if (!prediction || prediction.status !== "open") {
        return res.status(400).json({ ok: false, message: "닫힌 마켓입니다." });
      }

      if (new Date(prediction.close_time).getTime() < Date.now()) {
        return res.status(400).json({ ok: false, message: "마감된 마켓입니다." });
      }

      const { error } = await supabase.from("votes").insert({
        prediction_id: predictionId,
        user_key: userKey,
        choice,
        stake
      });

      if (error) {
        return res.status(400).json({ ok: false, message: "이미 선택했습니다." });
      }

      await supabase
        .from("profiles")
        .update({ points: profile.points - stake })
        .eq("user_key", userKey);

      await logPoint(userKey, -stake, "MARKET ENTRY");

      return res.json({ ok: true, message: `${stake} CREDIT ENTRY 완료` });
    }

    if (action === "comment") {
      const predictionId = body.predictionId;
      const comment = cleanText(body.comment, 140);

      if (comment.length < 2) {
        return res.status(400).json({ ok: false, message: "조금 더 입력해주세요." });
      }

      const hidden = hasBadWord(comment);

      await supabase.from("comments").insert({
        prediction_id: predictionId,
        user_key: userKey,
        nickname: profile.nickname,
        body: comment,
        is_hidden: hidden
      });

      if (hidden) {
        return res.json({ ok: true, message: "표현이 과해 숨김 처리되었습니다." });
      }

      const reward = 1;

      await supabase
        .from("profiles")
        .update({ points: profile.points + reward })
        .eq("user_key", userKey);

      await logPoint(userKey, reward, "MARKET ANALYSIS");

      return res.json({ ok: true, message: `ANALYSIS +${reward} CREDIT` });
    }

    if (action === "react") {
      const predictionId = body.predictionId;
      const type = body.type;

      if (!["angry", "laugh", "agree"].includes(type)) {
        return res.status(400).json({ ok: false, message: "invalid reaction" });
      }

      await supabase.from("reactions").insert({
        prediction_id: predictionId,
        user_key: userKey,
        type
      });

      return res.json({ ok: true, message: "반응 기록" });
    }

    return res.status(400).json({ ok: false, message: "unknown action" });
  } catch (e) {
    return res.status(500).json({ ok: false, message: e.message });
  }
}