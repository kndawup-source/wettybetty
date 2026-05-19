import {
  json,
  getUserById
} from "./_lib.js";

export default async function handler(req, res){
  res.setHeader("Content-Type","application/json; charset=utf-8");

  if(req.method !== "GET"){
    return json(res,405,{
      ok:false,
      message:"METHOD_NOT_ALLOWED"
    });
  }

  try{
    const userId =
      req.headers["x-user-id"] ||
      req.query.user_id;

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

    return json(res,200,{
      ok:true,
      user
    });

  }catch(err){
    console.error(err);

    return json(res,500,{
      ok:false,
      message:"SERVER_ERROR"
    });
  }
}