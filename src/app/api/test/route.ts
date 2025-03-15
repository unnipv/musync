export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';

/**
 * Test API route that returns the current session information
 * This helps verify that authentication is working correctly
 * 
 * @returns A response containing the session information
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    
    return NextResponse.json({
      success: true,
      authenticated: !!session,
      session: session ? {
        user: {
          id: session.user.id,
          name: session.user.name,
          email: session.user.email,
          image: session.user.image
        },
        expires: session.expires
      } : null
    });
  } catch (error) {
    console.error('Error in test API route:', error);
    return NextResponse.json(
      { success: false, message: 'Error in test API route', error: (error as Error).message },
      { status: 500 }
    );
  }
} 