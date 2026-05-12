import { createClient } from "@supabase/supabase-js";

export const config = {
  runtime: "nodejs"
};

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function json(res, status, data) {
  return res.status(status).json(data);
}

function nowIso() {
  return new Date().toISOString();
}

async function fetchActualRain(lat, lon, targetTime) {
  const target = new Date(targetTime);
  const date = target.toISOString().slice(0, 10);

  const url =
    `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${lat}&longitude=${lon}` +
    `&hourly=precipitation` +
    `&start_date=${date}` +
    `&end_date=${date}` +
    `&timezone=Asia%2FSeoul`;

  const res = await fetch(url, { cache: "no-store" });

  if (!res.ok) {
    throw new Error(`Open-Meteo error ${res.status}`);
  }

  const data = await res.json();
  const times = data?.hourly?.time || [];
  const rains = data?.hourly?.precipitation || [];

  if (!times.length) return 0;

  let bestIndex = 0;
  let bestDiff = Infinity;

  for (let i = 0; i < times.length; i++) {
    const diff = Math.abs(new Date(times[i]).getTime() - target.getTime());

    if (diff < bestDiff) {
      bestDiff = diff;
      bestIndex = i;
    }
  }

  return Number(rains[bestIndex] || 0);
}

function getResultChoice(prediction, actualRain) {
  const threshold = Number(prediction.rain_threshold_mm || 0.1);
  return actualRain >= threshold ? "rain" : "clear";
}

function getPayout(stake) {
  return Number(stake || 0) * 2;
}

export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") {
    return json(res, 405, {
      ok: false,
      message: "GET or POST only"
    });
  }

  try {
    const adminKey = req.method === "POST" ? req.body?.adminKey : req.query?.adminKey;

    if (!process.env.ADMIN_KEY || adminKey !== process.env.ADMIN_KEY) {
      return json(res, 401, {
        ok: false,
        message: "관리자 인증 실패"
      });
    }

    const now = nowIso();

    const { data: predictions, error: predictionError } = await supabase
      .from("predictions")
      .select("*")
      .eq("status", "open")
      .lte("target_time", now)
      .limit(20);

    if (predictionError) throw predictionError;

    if (!predictions || !predictions.length) {
      return json(res, 200, {
        ok: true,
        message: "정산할 예측이 없습니다.",
        settled: 0,
        results: []
      });
    }

    const results = [];

    for (const prediction of predictions) {
      try {
        const { data: currentPrediction, error: currentError } = await supabase
          .from("predictions")
          .select("*")
          .eq("id", prediction.id)
          .maybeSingle();

        if (currentError) throw currentError;

        if (!currentPrediction || currentPrediction.status !== "open") {
          results.push({
            id: prediction.id,
            title: prediction.title,
            skipped: true,
            reason: "이미 정산되었거나 존재하지 않음"
          });
          continue;
        }

        const actualRain = await fetchActualRain(
          currentPrediction.lat,
          currentPrediction.lon,
          currentPrediction.target_time
        );

        const resultChoice = getResultChoice(currentPrediction, actualRain);

        const { data: votes, error: votesError } = await supabase
          .from("votes")
          .select("*")
          .eq("prediction_id", currentPrediction.id);

        if (votesError) throw votesError;

        const voteRows = votes || [];

        let winCount = 0;
        let loseCount = 0;
        let totalPayout = 0;

        for (const vote of voteRows) {
          if (vote.status === "settled") {
            continue;
          }

          const isCorrect = vote.choice === resultChoice;
          const payout = isCorrect ? getPayout(vote.stake) : 0;

          if (isCorrect) winCount++;
          else loseCount++;

          totalPayout += payout;

          const { error: voteUpdateError } = await supabase
            .from("votes")
            .update({
              status: "settled",
              result: resultChoice,
              is_correct: isCorrect,
              payout,
              actual_value: actualRain,
              settled_at: now
            })
            .eq("id", vote.id)
            .neq("status", "settled");

          if (voteUpdateError) throw voteUpdateError;

          if (payout > 0) {
            const { data: profile, error: profileError } = await supabase
              .from("profiles")
              .select("points, streak")
              .eq("user_key", vote.user_key)
              .maybeSingle();

            if (profileError) throw profileError;

            if (profile) {
              const { error: profileUpdateError } = await supabase
                .from("profiles")
                .update({
                  points: Number(profile.points || 0) + payout,
                  streak: Number(profile.streak || 0) + 1
                })
                .eq("user_key", vote.user_key);

              if (profileUpdateError) throw profileUpdateError;

              await supabase.from("point_logs").insert({
                user_key: vote.user_key,
                amount: payout,
                reason: `PICK WIN · ${currentPrediction.title}`
              });
            }
          } else {
            const { data: profile, error: profileError } = await supabase
              .from("profiles")
              .select("streak")
              .eq("user_key", vote.user_key)
              .maybeSingle();

            if (profileError) throw profileError;

            if (profile) {
              await supabase
                .from("profiles")
                .update({
                  streak: 0
                })
                .eq("user_key", vote.user_key);
            }
          }
        }

        const { error: predictionUpdateError } = await supabase
          .from("predictions")
          .update({
            status: "settled",
            result: resultChoice,
            actual_value: actualRain,
            settled_at: now
          })
          .eq("id", currentPrediction.id)
          .eq("status", "open");

        if (predictionUpdateError) throw predictionUpdateError;

        results.push({
          id: currentPrediction.id,
          title: currentPrediction.title,
          region: currentPrediction.region,
          actualRain,
          result: resultChoice,
          votes: voteRows.length,
          wins: winCount,
          losses: loseCount,
          totalPayout,
          settled: true
        });
      } catch (innerError) {
        results.push({
          id: prediction.id,
          title: prediction.title,
          settled: false,
          error: innerError.message
        });
      }
    }

    return json(res, 200, {
      ok: true,
      message: `${results.filter(x => x.settled).length}개 예측 정산 완료`,
      settled: results.filter(x => x.settled).length,
      results
    });
  } catch (e) {
    return json(res, 500, {
      ok: false,
      message: e.message || "정산 실패"
    });
  }
}