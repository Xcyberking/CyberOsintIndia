import { NextResponse } from "next/server";
import { adminDb, verifyBearer } from "@/lib/firebase/admin";
import { refundCharge } from "@/lib/firebase/wallet";
export const runtime="nodejs";
export async function POST(request:Request){
 try{
  const user=await verifyBearer(request);const {chargeId}=await request.json();
  if(typeof chargeId!=="string"||! /^[a-f0-9]{20,40}$/i.test(chargeId))return NextResponse.json({error:"Invalid charge."},{status:400});
  const balance=await refundCharge(adminDb(),user.uid,chargeId);
  return NextResponse.json({ok:true,remaining_wallet:balance});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Could not refund query."},{status:400});}
}
