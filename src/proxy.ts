import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
export async function proxy(request: NextRequest) {
  const appUrl=process.env.APP_URL;
  if(appUrl?.startsWith('https://')&&request.headers.get('x-forwarded-proto')==='http') {
    // Canonical trusted origin; never construct redirects from Host/X-Forwarded-Host.
    const destination=new URL(appUrl);destination.pathname=request.nextUrl.pathname;destination.search=request.nextUrl.search;
    return NextResponse.redirect(destination,308);
  }
  let response = NextResponse.next({ request });
  const env = process.env;
  const url = Reflect.get(env, 'NEXT_PUBLIC_SUPABASE_URL');
  const key = Reflect.get(env, 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY');
  if (url && key) {
    const client = createServerClient(url, key, {
      cookieOptions: { httpOnly: true, sameSite: "lax", secure: process.env.APP_URL?.startsWith("https:"), path: "/" },
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(values) {
          values.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          values.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    });
    try { await client.auth.getClaims(); } catch { /* Pages and handlers fail closed independently. */ }
  }
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico|api/health).*)"] };
