import Link from "next/link";
import {requireAdmin} from "@/lib/auth";
export default async function AdminActivity(){
 const {supabase}=await requireAdmin();
 const [{data:history},{data:transactions}]=await Promise.all([
  supabase.from("search_history").select("id,user_id,tool_slug,input_summary,status,created_at").order("created_at",{ascending:false}).limit(100),
  supabase.from("credit_transactions").select("id,user_id,amount,reason,created_at").order("created_at",{ascending:false}).limit(100)
 ]);
 const ids=[...new Set([...(history||[]).map(x=>x.user_id),...(transactions||[]).map(x=>x.user_id)])];
 const {data:people}=ids.length?await supabase.from("profiles").select("id,email,display_name").in("id",ids):{data:[]};
 const names=new Map((people||[]).map(p=>[p.id,p.email||p.display_name||p.id]));
 return <main className="panel-page"><Link href="/admin">← Control center</Link><span className="eyebrow">AUDIT & ACTIVITY</span><h1>Activity logs</h1><h2>Recent tool usage</h2><div className="table-wrap"><table><thead><tr><th>User</th><th>Tool</th><th>Input summary</th><th>Status</th><th>Date</th></tr></thead><tbody>{history?.map(x=><tr key={x.id}><td>{names.get(x.user_id)||x.user_id}</td><td>{x.tool_slug}</td><td>{x.input_summary}</td><td>{x.status}</td><td>{new Date(x.created_at).toLocaleString()}</td></tr>)}{!history?.length&&<tr><td colSpan={5}>No activity found.</td></tr>}</tbody></table></div><h2>Credit transactions</h2><div className="table-wrap"><table><thead><tr><th>User</th><th>Amount</th><th>Reason</th><th>Date</th></tr></thead><tbody>{transactions?.map(x=><tr key={x.id}><td>{names.get(x.user_id)||x.user_id}</td><td>{x.amount>0?"+":""}{x.amount}</td><td>{x.reason}</td><td>{new Date(x.created_at).toLocaleString()}</td></tr>)}{!transactions?.length&&<tr><td colSpan={4}>No credit transactions.</td></tr>}</tbody></table></div></main>;
}