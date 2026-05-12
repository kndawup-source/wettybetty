export const config = {
  runtime: "nodejs"
};

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function calcLeaderboard(scoreRows = [], profiles = []) {
  const profileMap = new Map();
  profiles.forEach(p => {
    profileMap.set(p.user_key, {
      nickname: p.nickname,
      points: p.points || 0,
      streak: p.streak || 0
    });
  });

  const map = new Map();

  scoreRows.forEach(row => {
    if (!map.has(row.user_key)) {
      const p = profileMap.get(row.user_key) || {};
      map.set(row.user_key, {
        nickname: p.nickname || "익명",
        points: p.points || 0,
        total: 0,
        wins: 0,
        pending: 0,
        streak: p.streak || 0
      });
    }

    const item = map.get(row.user_key);
    item.total += 1;

    const settled = row.status === "settled" || row.result;
    if (!settled) item.pending += 1;
    if (settled && row.is_correct === true) item.wins += 1;
  });

  return [...map.values()]
    .map(x => ({
      ...x,
      hitRate: x.total ? Math.round((x.wins / Math.max(1, x.total - x.pending)) * 100) : 0
    }))
    .sort((a, b) => {
      if (b.hitRate !== a.hitRate) return b.hitRate - a.hitRate;
      if (b.streak !== a.streak) return b.streak - a.streak;
      return b.points - a.points;
    })
    .slice(0, 5);
}

export default async function handler(req, res) {
  try {
    res.setHeader("Cache-Control", "no-store");

    const userKey = String(req.query.userKey || "");

    const { data: predictions, error: pError } = await supabase
      .from("predictions")
      .select("*")
      .order("close_time", { ascending: true })
      .limit(80);

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
      return res.status(200).json({
        ok: true,
        profile,
        stats,
        scoreHistory,
        leaderboard: [],
        predictions: []
      });
    }

    const [votesResult, commentsResult, reactionsResult, allHistoryResult, profilesResult] =
      await Promise.all([
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
          .limit(160),

        supabase
          .from("reactions")
          .select("prediction_id, type")
          .in("prediction_id", predictionIds),

        supabase
          .from("user_score_history")
          .select("user_key, status, result, is_correct, stake")
          .limit(1000),

        supabase
          .from("profiles")
          .select("user_key, nickname, points, streak")
          .limit(500)
      ]);

    if (votesResult.error) throw votesResult.error;
    if (commentsResult.error) throw commentsResult.error;
    if (reactionsResult.error) throw reactionsResult.error;
    if (allHistoryResult.error) throw allHistoryResult.error;
    if (profilesResult.error) throw profilesResult.error;

    const votes = votesResult.data || [];
    const comments = commentsResult.data || [];
    const reactions = reactionsResult.data || [];

    const leaderboard = calcLeaderboard(
      allHistoryResult.data || [],
      profilesResult.data || []
    );

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
      leaderboard,
      predictions: enriched
    });
  } catch (e) {
    return res.status(500).json({ ok: false, message: e.message });
  }
}