import { NextRequest, NextResponse } from "next/server";
import { lookup } from "node:dns/promises";
import net from "node:net";

export const runtime = "nodejs";

// Block loopback / private / link-local targets so this endpoint cannot be used to probe internal networks.
function isPrivate(ip: string) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
  }
  const v = ip.toLowerCase();
  return v === "::1" || v === "::" || v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe80") || v.startsWith("::ffff:");
}

export async function GET(req: NextRequest) {
  const raw = (req.nextUrl.searchParams.get("url") || "").trim();
  let u: URL;
  try { u = new URL(/^https?:\/\//i.test(raw) ? raw : "https://" + raw); }
  catch { return NextResponse.json({ error: "Enter a valid website URL." }, { status: 400 }); }
  if (!["http:", "https:"].includes(u.protocol) || u.username || u.password || (u.port && !["80", "443"].includes(u.port))) {
    return NextResponse.json({ error: "Only plain http/https websites on standard ports are supported." }, { status: 400 });
  }
  try {
    const addrs = await lookup(u.hostname, { all: true });
    if (!addrs.length || addrs.some((a) => isPrivate(a.address))) {
      return NextResponse.json({ error: "Only public websites can be analyzed." }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "That hostname could not be resolved." }, { status: 400 });
  }
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  const t0 = Date.now();
  try {
    // redirect: "manual" so a public site cannot bounce the request to an internal address.
    const r = await fetch(u.href, { redirect: "manual", signal: ctrl.signal, headers: { "user-agent": "CyberXOSINT/1.0 (public website check)" } });
    const ms = Date.now() - t0;
    const type = r.headers.get("content-type") || "";
    let title = "—";
    if (type.includes("text/html")) {
      const html = (await r.text()).slice(0, 200000);
      const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
      if (m) title = m[1].replace(/\s+/g, " ").trim().slice(0, 150) || "—";
    } else {
      await r.body?.cancel();
    }
    const loc = r.headers.get("location");
    return NextResponse.json({
      website: u.href,
      title,
      server: r.headers.get("server") || "Not disclosed",
      responseTime: ms + " ms",
      httpStatus: r.status,
      ssl: u.protocol === "https:" ? "Valid" : "Not used (HTTP)",
      contentType: type || "—",
      ...(loc ? { redirectsTo: loc } : {}),
      note: "Fetched once from the server with a single GET request. Redirects are reported, not followed. This is not a malware or reputation verdict."
    });
  } catch {
    return NextResponse.json({ error: "The website did not respond in time or refused the connection." }, { status: 502 });
  } finally {
    clearTimeout(timer);
  }
}
