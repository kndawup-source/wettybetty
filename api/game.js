import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  try {
    res.setHeader("Cache-Control", "no-store");
    const userKey = String(req.query.userKey || "");

    const { data: predictions, error: pError } = await supabase
      .from("predictions")
      .select("*")
      .order("close_time", { ascending: true })
      .limit(30);

    if (pError) throw pError;

    const predictionIds = (predictions || []).map(p => p.id);

    let profile = null;
    let scoreHistory = [];
    let stats = {
      totalPicks: 0,
      wins: 0,
      losses: 0,
      pending: 0,
      hitRate: 0,
      currentStreak: 0
    };

    if (userKey) {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_key", userKey)
        .maybeSingle();

      profile = data || null;

      const { data: history } = await supabase
        .from("user_score_history")
        .select("*")
        .eq("user_key", userKey)
        .order("created_at", { ascending: false })
        .limit(30);

      scoreHistory = history || [];

      const settled = scoreHistory.filter(x => x.status === "settled" || x.result);
      const wins = settled.filter(x => x.is_correct === true).length;
      const losses = settled.filter(x => x.is_correct === false).length;
      const pending = scoreHistory.length - settled.length;

      let streak = 0;
      for (const item of scoreHistory) {
        if (!(item.status === "settled" || item.result)) continue;
        if (item.is_correct === true) streak++;
        else break;
      }

      stats = {
        totalPicks: scoreHistory.length,
        wins,
        losses,
        pending,
        hitRate: settled.length ? Math.round((wins / settled.length) * 100) : 0,
        currentStreak: streak
      };
    }

    if (!predictionIds.length) {
      return res.status(200).json({ ok: true, profile, stats, scoreHistory, predictions: [] });
    }

    const [votesResult, commentsResult, reactionsResult] = await Promise.all([
      supabase
        .from("votes")
        .select("prediction_id, choice, stake, user_key")
        .in("prediction_id", predictionIds),

      supabase
        .from("comments")
        .select("id, prediction_id, nickname, body, created_at")
        .in("prediction_id", predictionIds)
        .eq("is_hidden", false)
        .order("created_at", { ascending: false })
        .limit(120),

      supabase
        .from("reactions")
        .select("prediction_id, type")
        .in("prediction_id", predictionIds)
    ]);

    if (votesResult.error) throw votesResult.error;
    if (commentsResult.error) throw commentsResult.error;
    if (reactionsResult.error) throw reactionsResult.error;

    const votes = votesResult.data || [];
    const comments = commentsResult.data || [];
    const reactions = reactionsResult.data || [];

    const enriched = predictions.map(p => {
      const pVotes = votes.filter(v => v.prediction_id === p.id);
      const pComments = comments.filter(c => c.prediction_id === p.id).slice(0, 8);
      const pReactions = reactions.filter(r => r.prediction_id === p.id);

      const rainStake = pVotes
        .filter(v => v.choice === "rain")
        .reduce((sum, v) => sum + Number(v.stake || 0), 0);

      const clearStake = pVotes
        .filter(v => v.choice === "clear")
        .reduce((sum, v) => sum + Number(v.stake || 0), 0);

      const total = rainStake + clearStake || 1;
      const rainPercent = Math.round((rainStake / total) * 100);

      return {
        ...p,
        rainStake,
        clearStake,
        totalStake: rainStake + clearStake,
        rainPercent,
        clearPercent: 100 - rainPercent,
        myVote: pVotes.find(v => v.user_key === userKey) || null,
        comments: pComments,
        reactionCount: {
          angry: pReactions.filter(r => r.type === "angry").length,
          laugh: pReactions.filter(r => r.type === "laugh").length,
          agree: pReactions.filter(r => r.type === "agree").length
        }
      };
    });

    return res.status(200).json({
      ok: true,
      profile,
      stats,
      scoreHistory,
      predictions: enriched
    });
  } catch (e) {
    return res.status(500).json({ ok: false, message: e.message });
  }
}