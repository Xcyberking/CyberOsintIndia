"use client";
import Link from "next/link";
import {useState} from "react";
import type {ReactNode} from "react";
import {jsPDF} from "jspdf";
function Value({value}:{value:any}):ReactNode{
 if(value===null||value===undefined)return <span className="api-null">—</span>;
 if(typeof value==="boolean")return <span className={value?"api-true":"api-false"}>{value?"Yes":"No"}</span>;
 if(typeof value!=="object")return <span className="api-value">{String(value)}</span>;
 if(Array.isArray(value))return <div className="api-array">{value.map((v,i)=><div className="api-array-item" key={i}><Value value={v}/></div>)}</div>;
 return <div className="api-object">{Object.entries(value).map(([k,v])=><div className="api-field" key={k}><b>{k.replace(/[_-]/g," ")}</b><Value value={v}/></div>)}</div>;
}
export default function CustomToolRunner({slug,title,description,creditCost}:{slug:string;title:string;description:string|null;creditCost:number}){
 const [input,setInput]=useState("");const [result,setResult]=useState<any>(null);const [busy,setBusy]=useState(false);
 async function run(){setBusy(true);setResult(null);try{const r=await fetch("/api/tools",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({tool:slug,input})});const payload=await r.json();if(!r.ok)throw new Error(payload.error||"API request failed");setResult(payload);}catch(e){setResult({error:e instanceof Error?e.message:"Request failed"});}finally{setBusy(false);}}
 function exportPdf(){if(!result)return;const doc=new jsPDF();doc.setFontSize(18);doc.text("CyberX OSINT Report",14,18);doc.setFontSize(10);doc.text("Tool: "+title,14,28);doc.text("Generated: "+new Date().toLocaleString(),14,35);const lines=doc.splitTextToSize(JSON.stringify(result.result?.data??result,null,2),180);let y=45;for(let i=0;i<lines.length;i+=42){doc.text(lines.slice(i,i+42),14,y);if(i+42<lines.length){doc.addPage();y=18;}}doc.save("cyberx-"+slug+"-report.pdf");}
 return <main className="panel-page"><Link href="/tools">← All tools</Link><span className="eyebrow">CONNECTED API TOOL · {creditCost} CREDIT{creditCost===1?"":"S"}</span><h1>{title}</h1><p>{description||"Enter a value and run the connected API lookup."}</p><div className="tool-form"><input value={input} onChange={e=>setInput(e.target.value)} placeholder="Enter search value…" maxLength={12000}/><button className="primary" disabled={busy||input.trim().length===0} onClick={run}>{busy?"Fetching…":"Run lookup"}</button></div>
 {result?.error&&<div className="error">{result.error}</div>}
 {result?.result&&<section className="api-result-card"><div className="api-result-head"><div><span className="eyebrow">API RESPONSE</span><h2>Lookup results</h2><small>{result.result.contentType||"Response"} · {result.result.format==="text"?"Text response":"Structured response"}</small></div><button className="ghost" onClick={exportPdf}>Export PDF</button></div><Value value={result.result.data}/><div className="api-result-foot">Credits charged: {result.creditsCharged} · Remaining: {result.remainingCredits??"—"}</div></section>}
 </main>;
}