import { NextResponse } from "next/server";
import { requireAdmin, verifyBearer } from "@/lib/firebase/admin";
import { supabaseConfig, supabaseRest } from "@/lib/supabase/rest";

export const runtime = "nodejs";
const BUCKETS = new Set(["cyberx-site-media", "cyberx-avatars", "cyberx-user-media"]);
const IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

function safePath(value: string) {
  const path = value.replace(/^\/+/, "");
  if (!path || path.split("/").some(part => !part || part === "." || part === "..") || path.includes("\\") || path.length > 500) {
    throw new Error("Invalid storage path.");
  }
  return path;
}
function assertPathAccess(bucket: string, path: string, uid: string, isAdmin: boolean) {
  if (bucket === "cyberx-site-media") {
    if (!isAdmin) throw new Error("Administrator permission required to upload site images.");
    return;
  }
  if (!isAdmin && path.split("/")[0] !== uid) throw new Error("You can only access your own uploaded image.");
}

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const operation = String(form.get("operation") || "upload");
    const bucket = String(form.get("bucket") || "");
    const path = safePath(String(form.get("path") || ""));
    if (!BUCKETS.has(bucket)) return NextResponse.json({error:"Unknown image bucket."},{status:400});

    let decoded = await verifyBearer(request);
    if (decoded.admin === true || (operation === "upload" && bucket === "cyberx-site-media")) {
      decoded = await requireAdmin(request);
    }
    const isAdmin = decoded.admin === true;
    assertPathAccess(bucket,path,decoded.uid,isAdmin);

    const {url,key}=supabaseConfig();
    if (operation === "upload") {
      const file = form.get("file");
      if (!(file instanceof File)) return NextResponse.json({error:"Select an image file first."},{status:400});
      const maxBytes = bucket === "cyberx-site-media" ? 2*1024*1024 : 5*1024*1024;
      if (!IMAGE_TYPES.has(file.type) || file.size > maxBytes) return NextResponse.json({error:"Only PNG, JPG or WebP images are allowed. Maximum size: "+Math.floor(maxBytes/1024/1024)+" MB."},{status:400});
      const headers = new Headers({apikey:key,Authorization:"Bearer "+key,"Content-Type":file.type,"x-upsert":String(form.get("upsert")==="true")});
      const response = await fetch(url+"/storage/v1/object/"+bucket+"/"+path.split("/").map(encodeURIComponent).join("/"),{method:"POST",headers,body:await file.arrayBuffer(),cache:"no-store"});
      const raw = await response.text();
      if(!response.ok) throw new Error("Supabase Storage upload failed ("+response.status+"): "+raw);
      return NextResponse.json({data:{path,bucket},error:null});
    }
    if (operation === "signed-url") {
      if (bucket === "cyberx-site-media") {
        return NextResponse.json({data:{signedUrl:url+"/storage/v1/object/public/"+bucket+"/"+path.split("/").map(encodeURIComponent).join("/")},error:null});
      }
      const expiresIn = Math.max(60,Math.min(Number(form.get("expiresIn")||3600),604800));
      const {data}=await supabaseRest("/storage/v1/object/sign/"+bucket+"/"+path.split("/").map(encodeURIComponent).join("/"),{method:"POST",body:JSON.stringify({expiresIn})});
      const signedPath = data && typeof data==="object" && "signedURL" in data ? String((data as {signedURL:unknown}).signedURL) : "";
      if(!signedPath) throw new Error("Supabase did not return an image URL.");
      return NextResponse.json({data:{signedUrl:signedPath.startsWith("http")?signedPath:url+"/storage/v1"+(signedPath.startsWith("/")?signedPath:"/"+signedPath)},error:null});
    }
    return NextResponse.json({error:"Unsupported storage operation."},{status:400});
  } catch (error) {
    const message=error instanceof Error?error.message:"Image storage request failed.";
    const status=/Administrator permission|only access|Verify your email|Sign in/.test(message)?403:400;
    return NextResponse.json({error:message},{status});
  }
}
