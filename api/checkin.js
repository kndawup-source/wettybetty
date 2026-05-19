import {
  supabase,
  json,
  nowISO,
  getUserById
} from "./_lib.js";

function getKSTDateString(){
  const now = new Date();

  const kst = new Date(
    now.toLocaleString("en-US", {
      timeZone: "Asia/Seoul"
    })
  );

  const y = kst.getFullYear();
  const m = String(kst.getMonth() + 1).padStart(2,"0");
  const d = String(kst.getDate()).padStart(2,"0");

  return `${y}-${m}-${d}`;
}

export default async function handler(req, res){
  res.setHeader("Content-Type","application/json; charset=utf-8");

  if(req.method !== "POST"){
    return json(res,405,{
      ok:false,
      message:"METHOD_NOT_ALLOWED"
    });
  }

  try{
    const userId = req.headers["x-user-id"];

    if(!userId){
      return json(res,401,{
        ok:false,
        message:"UNAUTHORIZED"
      });
    }

    const user = await getUserById(userId);

    if(!user){
      return json(res,404,{
        ok:false,
        message:"USER_NOT_FOUND"
      });
    }

    const today = getKSTDateString();

    const { data:already } = await supabase
      .from("wetty_checkins")
      .select("id")
      .eq("user_id", userId)
      .eq("checkin_date", today)
      .maybeSingle();

    if(already){
      return json(res,409,{
        ok:false,
        message:"오늘은 이미 출석했습니다"
      });
    }

    const rewardPoint = 100;

    const { error: insertError } = await supabase
      .from("wetty_checkins")
      .insert({
        user_id: userId,
        points: rewardPoint,
        checkin_date: today,
        created_at: nowISO()
      });

    if(insertError){
      console.error(insertError);

      return json(res,500,{
        ok:false,
        message:"CHECKIN_INSERT_FAILED"
      });
    }

    await supabase
      .from("wetty_users")
      .update({
        points: Number(user.points || 0) + rewardPoint,
        streak: Number(user.streak || 0) + 1,
        updated_at: nowISO()
      })
      .eq("id", userId);

    return json(res,200,{
      ok:true,
      reward: rewardPoint
    });

  }catch(err){
    console.error(err);

    return json(res,500,{
      ok:false,
      message:"SERVER_ERROR"
    });
  }
}