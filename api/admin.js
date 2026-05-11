import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function auth(req) {
  const pin = req.headers["x-admin-pin"];
  return pin && process.env.ADMIN_PIN && pin === process.env.ADMIN_PIN;
}

function clean(v, max = 200) {
  return String(v || "").trim().slice(0, max);
}

async function addPoint(userKey, amount, reason) {
  const { data: profile } = await supabase
    .from("profiles")
    .select("points")
    .eq("user_key", userKey)
    .maybeSingle();

  if (!profile) return;

  await supabase
    .from("profiles")
    .update({ points: Number(profile.points || 0) + amount })
    .eq("user_key", userKey);

  await supabase.from("point_logs").insert({
    user_key: userKey,
    amount,
    reason
  });
}

export default async function handler(req, res) {
  try {
    if (!auth(req)) return res.status(401).json({ ok: false, message: "unauthorized" });

    if (req.method === "GET") {
      const { data: predictions, error } = await supabase
        .from("predictions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;

      return res.json({ ok: true, predictions: predictions || [] });
    }

    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, message: "POST only" });
    }

    const body = req.body || {};
    const action = body.action;

    if (action === "create_market") {
      const title = clean(body.title, 120);
      const region = clean(body.region, 80);
      const official = clean(body.official_forecast || "UNKNOWN", 40);
      const target_time = body.target_time;
      const close_time = body.close_time;

      if (!title || !region || !target_time || !close_time) {
        return res.status(400).json({ ok: false, message: "필수값 누락" });
      }

      const { data, error } = await supabase
        .from("predictions")
        .insert({
          title,
          region,
          market_label: "RAIN MARKET",
          official_forecast: official,
          target_time,
          close_time,
          status: "open",
          rain_threshold_mm: Number(body.rain_threshold_mm || 0.1)
        })
        .select()
        .single();

      if (error) throw error;

      return res.json({ ok: true, message: "마켓 생성 완료", prediction: data });
    }

    if (action === "close_market") {
      const id = body.id;

      const { error } = await supabase
        .from("predictions")
        .update({ status: "closed" })
        .eq("id", id);

      if (error) throw error;

      return res.json({ ok: true, message: "마켓 마감 완료" });
    }

    if (action === "settle_market") {
      const id = body.id;
      const result = body.result;

      if (!["rain", "clear"].includes(result)) {
        return res.status(400).json({ ok: false, message: "result invalid" });
      }

      const { data: prediction } = await supabase
        .from("predictions")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (!prediction) return res.status(404).json({ ok: false, message: "not found" });
      if (prediction.status === "settled") {
        return res.json({ ok: true, message: "이미 정산된 마켓입니다." });
      }

      const { data: votes, error: vError } = await supabase
        .from("votes")
        .select("*")
        .eq("prediction_id", id);

      if (vError) throw vError;

      for (const v of votes || []) {
        const win = v.choice === result;

        await supabase
          .from("votes")
          .update({ is_correct: win })
          .eq("id", v.id);

        if (win) {
          const reward = Number(v.stake || 0) * 2;
          await addPoint(v.user_key, reward, "MARKET WIN");
        }
      }

      const { error } = await supabase
        .from("predictions")
        .update({
          status: "settled",
          result
        })
        .eq("id", id);

      if (error) throw error;

      return res.json({ ok: true, message: "정산 완료" });
    }

    return res.status(400).json({ ok: false, message: "unknown action" });
  } catch (e) {
    return res.status(500).json({ ok: false, message: e.message });
  }
}