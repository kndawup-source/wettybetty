import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  try {
    const userKey = String(req.query.userKey || "");

    const { data: predictions, error } = await supabase
      .from("predictions")
      .select("*")
      .order("close_time", { ascending: true });

    if (error) throw error;

    const enriched = [];

    for (const p of predictions || []) {
      const { data: votes } = await supabase
        .from("votes")
        .select("choice, stake, user_key")
        .eq("prediction_id", p.id);

      const rainStake = votes?.filter(v => v.choice === "rain").reduce((a, v) => a + v.stake, 0) || 0;
      const clearStake = votes?.filter(v => v.choice === "clear").reduce((a, v) => a + v.stake, 0) || 0;
      const totalStake = rainStake + clearStake || 1;

      const rainPercent = Math.round((rainStake / totalStake) * 100);
      const clearPercent = 100 - rainPercent;
      const myVote = votes?.find(v => v.user_key === userKey) || null;

      const { data: comments } = await supabase
        .from("comments")
        .select("*")
        .eq("prediction_id", p.id)
        .eq("is_hidden", false)
        .order("created_at", { ascending: false })
        .limit(24);

      const { data: reactions } = await supabase
        .from("reactions")
        .select("type")
        .eq("prediction_id", p.id);

      const reactionCount = {
        angry: reactions?.filter(r => r.type === "angry").length || 0,
        laugh: reactions?.filter(r => r.type === "laugh").length || 0,
        agree: reactions?.filter(r => r.type === "agree").length || 0
      };

      enriched.push({
        ...p,
        rainStake,
        clearStake,
        totalStake: rainStake + clearStake,
        rainPercent,
        clearPercent,
        myVote,
        comments: comments || [],
        reactionCount
      });
    }

    let profile = null;

    if (userKey) {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_key", userKey)
        .maybeSingle();

      profile = data || null;
    }

    return res.status(200).json({
      ok: true,
      profile,
      predictions: enriched
    });
  } catch (e) {
    return res.status(500).json({ ok: false, message: e.message });
  }
}