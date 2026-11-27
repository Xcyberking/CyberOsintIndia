const required = ["NEXT_PUBLIC_FIREBASE_API_KEY","NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN","NEXT_PUBLIC_FIREBASE_PROJECT_ID","NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET","NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID","NEXT_PUBLIC_FIREBASE_APP_ID","FIREBASE_SERVICE_ACCOUNT_JSON"];
const missing = required.filter((key) => !String(process.env[key] || "").trim());
if (missing.length) { console.error("Missing Firebase environment variables:", missing.join(", ")); process.exit(1); }
let serviceAccount;
try { serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON); }
catch { console.error("FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON. Paste the complete downloaded service-account JSON."); process.exit(1); }
const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
if (!projectId) { console.error("Missing FIREBASE_PROJECT_ID."); process.exit(1); }
if (projectId !== process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || projectId !== serviceAccount.project_id) { console.error("Project ID mismatch: FIREBASE_PROJECT_ID, NEXT_PUBLIC_FIREBASE_PROJECT_ID and service-account project_id must all match."); process.exit(1); }
if (!serviceAccount.client_email || !serviceAccount.private_key) { console.error("Service-account JSON is missing client_email or private_key."); process.exit(1); }
console.log("Firebase environment looks complete. Project ID:", projectId);
