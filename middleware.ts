import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

const PROTECTED = ['/dashboard', '/profile', '/admin', '/credits'];

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return response;
  try {
    const supabase = createServerClient(url, key, {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    });
    // getSession reads the cookie locally and only hits the network when the token must be refreshed.
    // Pages still verify the user with getUser() before returning private data.
    const { data: { session } } = await supabase.auth.getSession();
    const path = request.nextUrl.pathname;
    if (!session && PROTECTED.some((p) => path === p || path.startsWith(p + '/'))) {
      const to = request.nextUrl.clone();
      to.pathname = '/login';
      to.search = '';
      return NextResponse.redirect(to);
    }
  } catch (error) {
    console.error('[middleware] session refresh failed:', error instanceof Error ? error.message : 'unknown');
  }
  return response;
}

export const config = {
  matcher: ['/dashboard/:path*', '/profile/:path*', '/admin/:path*', '/credits/:path*', '/tools/:path+', '/api/tools'],
};
