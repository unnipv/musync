import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import authOptions from '@/lib/auth';
import dbConnect from '@/lib/mongoose';
import User from '@/lib/models/user';

/**
 * Debug endpoint to check session and user data
 * 
 * @param request - The incoming request
 * @returns Debug information about the session and user
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ 
        authenticated: false,
        message: 'No active session'
      });
    }
    
    // Basic session info without exposing sensitive data
    const sessionInfo = {
      authenticated: true,
      user: {
        name: session.user?.name,
        email: session.user?.email,
        image: session.user?.image
      },
      hasAccessToken: !!session.accessToken,
      hasError: !!session.error,
      error: session.error,
      hasUserId: !!session.userId
    };
    
    // Get user from database if we have a userId
    let userInfo = null;
    
    if (session.userId) {
      await dbConnect();
      const user = await User.findById(session.userId).lean();
      
      if (user) {
        userInfo = {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          hasPlatforms: !!user.platforms,
          platformsCount: user.platforms?.length || 0,
          platforms: user.platforms?.map((p: any) => ({
            name: p.name,
            userId: p.userId,
            hasLastSyncedAt: !!p.lastSyncedAt
          })) || []
        };
      } else {
        userInfo = {
          error: 'User not found in database despite having userId in session'
        };
      }
    }
    
    return NextResponse.json({
      timestamp: new Date().toISOString(),
      session: sessionInfo,
      user: userInfo
    });
  } catch (error) {
    console.error('Error in debug endpoint:', error);
    return NextResponse.json({
      error: 'Error fetching debug information',
      message: (error as Error).message
    }, { status: 500 });
  }
} 