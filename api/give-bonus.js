import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  try {
    const key = req.query.key;

    if (key !== process.env.ADMIN_KEY) {
      return res.status(401).json({
        ok: false,
        message: "관리자 키가 맞지 않습니다."
      });
    }

    const { data: profiles, error } = await supabase
      .from("profiles")
      .select("user_key, points");

    if (error) throw error;

    for (const p of profiles || []) {
      await supabase
        .from("profiles")
        .update({
          points: Number(p.points || 0) + 10000
        })
        .eq("user_key", p.user_key);

      await supabase.from("point_logs").insert({
        user_key: p.user_key,
        amount: 10000,
        reason: "ADMIN BONUS 10000"
      });
    }

    return res.json({
      ok: true,
      message: `전체 ${profiles?.length || 0}명에게 10,000P 지급 완료`
    });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      message: e.message
    });
  }
}