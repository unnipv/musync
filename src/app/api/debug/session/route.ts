import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongoose';
import User from '@/lib/models/user';

export const dynamic = 'force-dynamic';

/**
 * Debug endpoint to check the current session
 * @param req - The incoming request
 * @returns JSON response with session details
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({
        status: 'unauthenticated',
        message: 'You must be signed in to access this endpoint',
      }, { status: 401 });
    }
    
    // Log the session for debugging
    console.log('Session in debug route:', JSON.stringify(session, null, 2));
    
    return NextResponse.json({
      status: 'authenticated',
      session: {
        user: session.user,
        expires: session.expires,
        hasSpotifyToken: !!session.user?.spotifyAccessToken,
        hasGoogleToken: !!session.user?.googleAccessToken,
        hasUser: !!session.user,
        hasUserId: !!session.user?.id,
      }
    });
  } catch (error) {
    console.error('Error in debug session route:', error);
    return NextResponse.json({
      status: 'error',
      message: 'An error occurred while fetching the session',
      error: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
} 