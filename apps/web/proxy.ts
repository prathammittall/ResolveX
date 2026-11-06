import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Next.js proxy / middleware to forward API requests to the external backend service (e.g. Render).
 * Reads the target backend URL from BACKEND_URL or NEXT_PUBLIC_BACKEND_URL.
 */
export function proxy(request: NextRequest) {
  const backendUrl =
    process.env.BACKEND_URL ||
    process.env.NEXT_PUBLIC_BACKEND_URL ||
    'http://localhost:3000';

  let targetBase = backendUrl.trim().replace(/\/$/, '');
  if (!targetBase.startsWith('http://') && !targetBase.startsWith('https://')) {
    targetBase = `https://${targetBase}`;
  }

  const { pathname, search } = request.nextUrl;
  const destination = `${targetBase}${pathname}${search}`;

  return NextResponse.rewrite(new URL(destination));
}

// Aliases for compatibility across Next.js configurations
export const middleware = proxy;
export default proxy;

export const config = {
  matcher: ['/api/:path*'],
};

