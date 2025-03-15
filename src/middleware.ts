import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

/**
 * Middleware function to handle authentication redirects
 * 
 * @param request - The incoming request
 * @returns The response or undefined to continue
 */
export async function middleware(request: NextRequest) {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  const isAuthPage = request.nextUrl.pathname.startsWith('/login') || 
                     request.nextUrl.pathname.startsWith('/signup');
  
  // Redirect authenticated users away from auth pages
  if (isAuthPage && token) {
    return NextResponse.redirect(new URL('/playlists', request.url));
  }
  
  // Redirect unauthenticated users to login page for protected routes
  const isProtectedRoute = request.nextUrl.pathname.startsWith('/playlists') || 
                          request.nextUrl.pathname.startsWith('/profile');
  
  if (isProtectedRoute && !token) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('callbackUrl', request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }
  
  // Special handling for API auth routes to ensure they use our custom pages
  if (request.nextUrl.pathname.startsWith('/api/auth/signin')) {
    return NextResponse.redirect(new URL('/login', request.url));
  }
  
  return NextResponse.next();
}

/**
 * Configuration for which routes the middleware should run on
 */
export const config = {
  matcher: [
    '/login',
    '/signup',
    '/playlists/:path*',
    '/profile/:path*',
    '/api/auth/signin'
  ],
}; 