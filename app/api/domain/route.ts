import { NextRequest, NextResponse } from "next/server";
import { domainToASCII } from "node:url";

export async function GET(request: NextRequest) {
  const input = request.nextUrl.searchParams.get("domain")?.trim().toLowerCase() ?? "";
  const domain = domainToASCII(input.replace(/^https?:\\/\\//, "").split("/")[0].split(":")[0]);
  if (!domain || domain.length > 253 || !/^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\\.)+[a-z]{2,63}$/.test(domain)) {
    return NextResponse.json({ error: "Enter a valid public domain name." }, { status: 400 });
  }
  try {
    const response = await fetch("https://rdap.org/domain/" + encodeURIComponent(domain), { cache: "no-store", signal: AbortSignal.timeout(8000) });
    if (!response.ok) return NextResponse.json({ error: "No public RDAP record was returned for this domain." }, { status: 404 });
    const data = await response.json();
    const events = Array.isArray(data.events) ? data.events.map((event: { eventAction?: string; eventDate?: string }) => ({ action: event.eventAction, date: event.eventDate })) : [];
    return NextResponse.json({ domain: data.ldhName || domain, status: data.status || [], registrar: data.entities?.find((e: { roles?: string[] }) => e.roles?.includes("registrar"))?.vcardArray?.[1]?.find((v: unknown[]) => v[0] === "fn")?.[3] || "Not listed", events, nameservers: (data.nameservers || []).map((n: { ldhName?: string }) => n.ldhName).filter(Boolean) });
  } catch {
    return NextResponse.json({ error: "The public domain registry service is temporarily unavailable." }, { status: 502 });
  }
}