import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * Test endpoint for authentication
 * @param req - The incoming request
 * @returns JSON response with authentication status
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({
        authenticated: false,
        message: 'Not authenticated'
      });
    }
    
    return NextResponse.json({
      authenticated: true,
      message: 'Authenticated',
      user: session.user,
      accessToken: session.accessToken
    });
  } catch (error) {
    console.error('Error in auth test route:', error);
    return NextResponse.json(
      { error: 'Failed to test authentication', details: String(error) },
      { status: 500 }
    );
  }
} 