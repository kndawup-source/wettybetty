import generatePredictions from "./generate-predictions.js";

export default async function handler(req,res){
  return generatePredictions(req,res);
}