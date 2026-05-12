import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const BAD_WORDS = ["씨발","시발","ㅅㅂ","병신","ㅂㅅ","좆","개새","미친년","미친놈"];

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
  await supabase.from("point_logs").insert({ user_key: userKey, amount, reason });
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

    if (action === "give_bonus_10000") {
      const ADMIN_KEY = process.env.ADMIN_KEY;

      if (!ADMIN_KEY || body.adminKey !== ADMIN_KEY) {
        return res.status(401).json({ ok:false, message:"관리자 인증 실패" });
      }

      const { data: profiles, error:getError } = await supabase
        .from("profiles")
        .select("user_key, points");

      if (getError) {
        return res.status(500).json({ ok:false, message:getError.message });
      }

      for (const p of profiles || []) {
        await supabase
          .from("profiles")
          .update({ points: Number(p.points || 0) + 10000 })
          .eq("user_key", p.user_key);

        await logPoint(p.user_key, 10000, "ADMIN BONUS 10000");
      }

      return res.json({
        ok:true,
        message:`전체 ${profiles?.length || 0}명에게 10,000P 지급 완료`
      });
    }

    if (!userKey) {
      return res.status(400).json({ ok: false, message: "userKey required" });
    }

    if (action === "create_profile") {
      const nickname = cleanText(body.nickname || "Player", 12);

      if (hasBadWord(nickname)) {
        return res.status(400).json({ ok: false, message: "사용할 수 없는 닉네임입니다." });
      }

      const exists = await getProfile(userKey);
      if (exists) return res.json({ ok: true, message: "이미 가입되어 있습니다.", profile: exists });

      const referralCode = "WB" + Math.random().toString(36).slice(2, 8).toUpperCase();

      const { data, error } = await supabase
        .from("profiles")
        .insert({
          user_key: userKey,
          nickname,
          points: 10000,
          referral_code: referralCode
        })
        .select()
        .single();

      if (error) throw error;
      await logPoint(userKey, 10000, "WELCOME BONUS");

      return res.json({ ok: true, message: "가입 보너스 10,000P 지급", profile: data });
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

      const reward = 200;

      await supabase
        .from("profiles")
        .update({
          points: Number(profile.points || 0) + reward,
          streak: Number(profile.streak || 0) + 1,
          last_checkin_date: today
        })
        .eq("user_key", userKey);

      await logPoint(userKey, reward, "DAILY CLAIM");

      return res.json({ ok: true, message: `출석 +${reward}P` });
    }

    if (action === "vote") {
      const predictionId = body.predictionId;
      const choice = body.choice;
      const stake = Number(body.stake || 100);

      if (!["rain", "clear"].includes(choice)) {
        return res.status(400).json({ ok: false, message: "invalid choice" });
      }

      if (![50, 100, 300, 500].includes(stake)) {
        return res.status(400).json({ ok: false, message: "invalid stake" });
      }

      if (Number(profile.points || 0) < stake) {
        return res.status(400).json({ ok: false, message: "포인트 부족" });
      }

      const { data: prediction } = await supabase
        .from("predictions")
        .select("*")
        .eq("id", predictionId)
        .maybeSingle();

      if (!prediction || prediction.status !== "open") {
        return res.status(400).json({ ok: false, message: "닫힌 예측입니다." });
      }

      if (new Date(prediction.close_time).getTime() < Date.now()) {
        return res.status(400).json({ ok: false, message: "마감된 예측입니다." });
      }

      const { data: voteData, error: voteError } = await supabase
  .from("votes")
  .insert({
    prediction_id: predictionId,
    user_key: userKey,
    choice,
    stake
  })
  .select()
  .single();

if (voteError) {
  return res.status(400).json({
    ok: false,
    message: voteError.message || "선택 저장 실패"
  });
}

await supabase.from("prediction_history").insert({
  user_key: userKey,
  prediction_id: predictionId,
  title: prediction.title,
  choice,
  stake,
  status: "pending",
  result: null,
  is_correct: null
});
const nextRainStake =
  choice === "rain"
    ? Number(prediction.rain_stake || 0) + stake
    : Number(prediction.rain_stake || 0);

const nextClearStake =
  choice === "clear"
    ? Number(prediction.clear_stake || 0) + stake
    : Number(prediction.clear_stake || 0);

const nextTotalStake =
  Number(prediction.total_stake || 0) + stake;

const { error: updatePredictionError } = await supabase
  .from("predictions")
  .update({
    rain_stake: nextRainStake,
    clear_stake: nextClearStake,
    total_stake: nextTotalStake
  })
  .eq("id", predictionId);

if (updatePredictionError) {
  return res.status(500).json({
    ok: false,
    message: updatePredictionError.message || "예측 반영 실패"
  });
}
      await supabase
        .from("profiles")
        .update({ points: Number(profile.points || 0) - stake })
        .eq("user_key", userKey);

      await logPoint(userKey, -stake, "PICK ENTRY");

      return res.json({ ok: true, message: `${stake}P 선택 완료` });
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

      if (hidden) return res.json({ ok: true, message: "표현이 과해 숨김 처리되었습니다." });

      const reward = 20;

      await supabase
        .from("profiles")
        .update({ points: Number(profile.points || 0) + reward })
        .eq("user_key", userKey);

      await logPoint(userKey, reward, "REACTION COMMENT");

      return res.json({ ok: true, message: `댓글 +${reward}P` });
    }

    if (action === "react") {
      const predictionId = body.predictionId;
      const type = body.type;

      if (!["angry", "laugh", "agree"].includes(type)) {
        return res.status(400).json({ ok: false, message: "invalid reaction" });
      }

      const { error } = await supabase.from("reactions").insert({
        prediction_id: predictionId,
        user_key: userKey,
        type
      });

      if (error) return res.json({ ok: true, message: "이미 반응했습니다." });

      return res.json({ ok: true, message: "반응 완료" });
    }

    return res.status(400).json({ ok: false, message: "unknown action" });
  } catch (e) {
    return res.status(500).json({ ok: false, message: e.message });
  }
}