import { NextRequest, NextResponse } from "next/server";
import { domainToASCII } from "node:url";

export async function GET(request: NextRequest) {
  const input = request.nextUrl.searchParams.get("domain")?.trim().toLowerCase() ?? "";
  const cleaned = input.replace("https://", "").replace("http://", "").split("/")[0].split(":")[0];
  const domain = domainToASCII(cleaned);
  const labels = domain.split(".");
  const valid = domain.length <= 253 && labels.length >= 2 &&
    labels.every((label) => label.length >= 1 && label.length <= 63 && /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label)) &&
    /^[a-z]{2,63}$/.test(labels[labels.length - 1] || "");
  if (!valid) {
    return NextResponse.json({ error: "Enter a valid public domain name." }, { status: 400 });
  }
  try {
    const response = await fetch("https://rdap.org/domain/" + encodeURIComponent(domain), { cache: "no-store", signal: AbortSignal.timeout(8000) });
    if (!response.ok) return NextResponse.json({ error: "No public RDAP record was returned for this domain." }, { status: 404 });
    const data = await response.json();
    const events = Array.isArray(data.events) ? data.events.map((event: { eventAction?: string; eventDate?: string }) => ({ action: event.eventAction, date: event.eventDate })) : [];
    const registrar = data.entities?.find((entity: { roles?: string[] }) => entity.roles?.includes("registrar"));
    const registrarName = registrar?.vcardArray?.[1]?.find((entry: unknown[]) => entry[0] === "fn")?.[3] || "Not listed";
    return NextResponse.json({
      domain: data.ldhName || domain,
      status: data.status || [],
      registrar: registrarName,
      events,
      nameservers: (data.nameservers || []).map((server: { ldhName?: string }) => server.ldhName).filter(Boolean)
    });
  } catch {
    return NextResponse.json({ error: "The public domain registry service is temporarily unavailable." }, { status: 502 });
  }
}
