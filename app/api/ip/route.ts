import { NextRequest, NextResponse } from "next/server";
import { isIP } from "node:net";

export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get("address")?.trim() ?? "";
  if (!raw || isIP(raw) === 0) {
    return NextResponse.json({ error: "Enter a valid IPv4 or IPv6 address." }, { status: 400 });
  }
  try {
    const response = await fetch("https://ipwho.is/" + encodeURIComponent(raw), { cache: "no-store", signal: AbortSignal.timeout(8000) });
    const data = await response.json();
    if (!response.ok || data.success === false) return NextResponse.json({ error: data.message || "Lookup unavailable." }, { status: 422 });
    return NextResponse.json({
      ip: data.ip, type: data.type, continent: data.continent, country: data.country,
      region: data.region, city: data.city, connection: data.connection?.isp,
      timezone: data.timezone?.id
    });
  } catch {
    return NextResponse.json({ error: "The public IP information service is temporarily unavailable." }, { status: 502 });
  }
}