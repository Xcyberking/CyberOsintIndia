"use client";
import Link from "next/link";
import {useState} from "react";
import {jsPDF} from "jspdf";
import * as exifr from "exifr";
const definitions:Record<string,{title:string;hint:string;placeholder:string}>={
 "ip-lookup":{title:"IP Lookup",hint:"Public IPv4 metadata only.",placeholder:"8.8.8.8"},
 "domain-lookup":{title:"Domain Lookup",hint:"Resolve public DNS records.",placeholder:"example.com"},
 "dns-lookup":{title:"Advanced DNS Lookup",hint:"A, AAAA, MX, TXT, NS, CAA and SOA records.",placeholder:"example.com"},
 "email-validator":{title:"Email Validator",hint:"Syntax validation only; no mailbox probing.",placeholder:"name@example.com"},
 "phone-validator":{title:"Phone Validator",hint:"International format only.",placeholder:"+14155552671"},
 "url-safety":{title:"URL Structure Check",hint:"Structure inspection only; not a malware verdict.",placeholder:"https://example.com"},
 "image-metadata":{title:"Image Metadata",hint:"Read selected metadata from your own image. GPS and device serial fields are excluded.",placeholder:"Choose an image file"}
};
const allowedMetadata=new Set(["Make","Model","DateTimeOriginal","CreateDate","ModifyDate","Orientation","ImageWidth","ImageHeight","ExifImageWidth","ExifImageHeight","Software","LensModel","FNumber","ExposureTime","ISO","FocalLength","Flash","WhiteBalance","ColorSpace","MIMEType"]);
export default function ToolRunner({slug}:{slug:string}){
 const def=definitions[slug];const [value,setValue]=useState("");const [file,setFile]=useState<File|null>(null);const [result,setResult]=useState<any>(null);const [busy,setBusy]=useState(false);
 async function run(){setBusy(true);setResult(null);try{
  let input=value.trim();
  if(slug==="image-metadata"){
   if(!file)throw new Error("Choose an image first.");
   if(file.size>10*1024*1024)throw new Error("Image must be 10 MB or smaller.");
   if(!file.type.startsWith("image/"))throw new Error("Choose a valid image file.");
   const raw=await exifr.parse(file,{gps:false});
   const metadata:Record<string,string|number|boolean|null>={};
   for(const [key,val] of Object.entries(raw||{}))if(allowedMetadata.has(key)&&["string","number","boolean"].includes(typeof val))metadata[key]=val as string|number|boolean;
   input=JSON.stringify({fileName:file.name,fileSize:file.size,mimeType:file.type,metadata});
  }
  const r=await fetch("/api/tools",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({tool:slug,input})});
  const payload=await r.json();if(!r.ok)throw new Error(payload.error||"Lookup failed.");setResult(payload);
 }catch(e){setResult({error:e instanceof Error?e.message:"Request failed. Try again."});}finally{setBusy(false);}}
 function exportPdf(){if(!result)return;const doc=new jsPDF();doc.setFontSize(18);doc.text("CyberX OSINT Report",14,18);doc.setFontSize(10);doc.text("Tool: "+(def?.title||slug),14,28);doc.text("Generated: "+new Date().toLocaleString(),14,35);const lines=doc.splitTextToSize(JSON.stringify(result,null,2),180);doc.text(lines,14,45);doc.save("cyberx-osint-report.pdf");}
 if(!def)return <main className="panel-page"><h1>Tool not found</h1><Link href="/tools">Back to tools</Link></main>;
 return <main className="panel-page"><Link href="/tools">← All tools</Link><span className="eyebrow">CYBERX TOOL</span><h1>{def.title}</h1><p>{def.hint}</p>
  <div className="tool-form">{slug==="image-metadata"?<input type="file" accept="image/*" onChange={e=>setFile(e.target.files?.[0]||null)}/>:<input value={value} onChange={e=>setValue(e.target.value)} placeholder={def.placeholder} maxLength={2048}/>}<button className="primary" disabled={busy||(slug==="image-metadata"?!file:value.trim().length<3)} onClick={run}>{busy?"Checking…":"Run lookup"}</button></div>
  {result&&<><pre className="result">{JSON.stringify(result,null,2)}</pre>{!result.error&&<button className="primary" onClick={exportPdf}>Export PDF report</button>}</>}
 </main>;
}
