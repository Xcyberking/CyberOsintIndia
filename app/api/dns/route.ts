import { NextRequest, NextResponse } from "next/server";
import { domainToASCII } from "node:url";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get("domain")?.trim().toLowerCase() ?? "";
  const host = raw.replace(/^https?:\/\//, "").split("/")[0].split(":")[0];
  const domain = domainToASCII(host);
  const labels = domain.split(".");
  const valid = domain.length <= 253 && labels.length >= 2 &&
    labels.every(label => label.length > 0 && label.length <= 63 &&
      /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label)) &&
    /^[a-z]{2,63}$/.test(labels.at(-1) || "");
  if (!valid) return NextResponse.json({ error: "Enter a valid public domain name." }, { status: 400 });

  const types = ["A", "AAAA", "MX", "NS", "TXT"] as const;
  try {
    const records = await Promise.all(types.map(async type => {
      const url = new URL("https://cloudflare-dns.com/dns-query");
      url.searchParams.set("name", domain);
      url.searchParams.set("type", type);
      const response = await fetch(url, {
        headers: { accept: "application/dns-json" },
        cache: "no-store",
        signal: AbortSignal.timeout(7000)
      });
      if (!response.ok) throw new Error("DNS provider unavailable");
      const body = await response.json();
      return {
        type,
        status: body.Status,
        records: (body.Answer || []).map((answer: { data?: string; TTL?: number }) => ({
          value: String(answer.data || "").slice(0, 500),
          ttl: answer.TTL
        }))
      };
    }));
    return NextResponse.json({ domain, provider: "Cloudflare DNS over HTTPS", records });
  } catch {
    return NextResponse.json({ error: "Public DNS lookup is temporarily unavailable." }, { status: 502 });
  }
}
