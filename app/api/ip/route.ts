import { NextRequest, NextResponse } from "next/server";
import { isIP } from "node:net";

function isNonPublicAddress(value: string): boolean {
  if (isIP(value) === 4) {
    const octets = value.split(".").map(Number);
    const [a,b] = octets;
    return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127) || a >= 224;
  }
  const normalized = value.toLowerCase();
  return normalized === "::" || normalized === "::1" || normalized.startsWith("fc") ||
    normalized.startsWith("fd") || normalized.startsWith("fe80:") || normalized.startsWith("ff");
}

export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get("address")?.trim() ?? "";
  if (!raw || isIP(raw) === 0 || isNonPublicAddress(raw)) {
    return NextResponse.json({ error: "Enter a public IPv4 or IPv6 address. Private and reserved network ranges are not looked up." }, { status: 400 });
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