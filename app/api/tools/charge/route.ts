import { NextResponse } from "next/server";
import { adminDb, verifyBearer } from "@/lib/firebase/admin";
import { chargeTool } from "@/lib/firebase/wallet";
import { getEnabledSupabaseTool } from "@/lib/supabase/rest";
export const runtime="nodejs";
export async function POST(request:Request){
 try{
  const user=await verifyBearer(request);
  const {slug}=await request.json();
  if(typeof slug!=="string"||! /^[a-z0-9][a-z0-9-]{1,79}$/.test(slug))return NextResponse.json({error:"Invalid tool."},{status:400});
  const tool=await getEnabledSupabaseTool(slug);
  if(!tool)return NextResponse.json({error:"This tool is unavailable."},{status:404});
  const charge=await chargeTool(adminDb(),user.uid,slug,tool);
  return NextResponse.json({ok:true,chargeId:charge.chargeId,price:charge.price,remaining_wallet:charge.balance});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Could not charge wallet."},{status:400});}
}
