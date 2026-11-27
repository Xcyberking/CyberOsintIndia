import { cert, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
if (!raw) throw new Error("Set FIREBASE_SERVICE_ACCOUNT_JSON first.");
let serviceAccount;
try { serviceAccount = JSON.parse(raw); } catch { throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON must be the complete service-account JSON."); }
const projectId = process.env.FIREBASE_PROJECT_ID || serviceAccount.project_id;
if (!projectId || projectId !== serviceAccount.project_id) throw new Error("FIREBASE_PROJECT_ID must match the service-account project_id.");
const app = initializeApp({ credential: cert(serviceAccount), projectId });
const db = getFirestore(app);
const tools = [
  ["username-tracker","Username Tracker","Build direct links to public profile pages without scraping accounts.","Public profiles","username"],
  ["dns-lookup","DNS Lookup","Query public A, AAAA, MX, NS and TXT DNS records.","Network","dns"],
  ["domain-lookup","Domain Analyzer","Retrieve public domain registration and nameserver information.","Web intelligence","domain"],
  ["email-validator","Email Validator","Validate syntax and inspect public MX records only.","Validation","email"],
  ["ip-lookup","IP Lookup","Show approximate public network metadata for public IP addresses.","Network","ip"],
  ["url-safety","Website Analyzer","Inspect URL structure and HTTPS information.","Web intelligence","url"],
  ["reverse-image-search","Reverse Image Search","Open third-party public image search engines for an image URL.","Media","image"],
  ["social-media-analyzer","Social Media Analyzer","Generate public profile links for a supplied username.","Public profiles","social"],
  ["breach-self-check","Breach Self-Check","Open the official Have I Been Pwned self-check page.","Account safety","breach"]
];
const batch = db.batch();
for (const [slug,name,description,category,handler] of tools) {
  const ref = db.collection("tools").doc(slug);
  batch.set(ref, { id: slug, slug, name, description, category, handler, credit_cost: 1, price_inr: 0, enabled: true, input_label: "Enter query", result_note: "", config: {}, created_at: new Date().toISOString() }, { merge: true });
}
for (const [key,value] of [
  ["payment_qr_url",""],["payment_instructions",""],
  ["default_signup_credits",{credits:3}],["referral_new_user_credits",{credits:7}],["referral_reward",{credits:3}]
]) batch.set(db.collection("site_settings").doc(key), { id:key, key, value, updated_at:new Date().toISOString() }, { merge:true });
await batch.commit();
console.log("Seeded 9 public research tools and default site settings.");
