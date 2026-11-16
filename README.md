# CyberX OSINT

Mobile-first dark cyber-blue OSINT workspace for ethical research and authorized security analysis.

## Added foundation
- Responsive CyberX homepage in the approved neon-blue visual direction.
- Tools directory for IP, username, email, phone, domain, DNS, image metadata and URL safety categories.
- Next.js 15, React 19 and TypeScript project configuration.
- Supabase schema foundation for profiles, tools, credits, search history, site settings and announcements.
- `.env.example` for Supabase and server-side provider configuration.

## Local setup
1. Install Node.js 20+.
2. Run `npm install`.
3. Copy `.env.example` to `.env.local` and fill in Supabase values.
4. Run `supabase/schema.sql` in the Supabase SQL Editor.
5. Run `npm run dev`.

## Implementation status
Homepage and tools directory are UI foundations. Authentication screens, provider-backed lookups, secure credit deduction, admin workflows, report export, API monitoring and production testing remain to be implemented and configured. Do not show provider-dependent tools as live until a provider is configured and tested. Keep service-role and provider API keys server-side only.

Use only public information and systems you own or are authorized to assess. No covert tracking, private-account access, credential harvesting, or exposure of personal data.
