import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import User from '@/models/User';

/**
 * Checks if the error is a database connection error
 * 
 * @param error - The error to check
 * @returns True if the error is a database connection error
 */
function isDatabaseError(error: any): boolean {
  return !!(error && 
    typeof error === 'object' && 
    (error.name === 'MongoNetworkError' || 
     error.name === 'MongoServerSelectionError' || 
     error.message?.includes('SSL routines') ||
     error.message?.includes('tlsv1 alert') ||
     error.message?.includes('Operating in offline mode')));
}

/**
 * Checks if the user is connected to YouTube Music
 * 
 * @param req - The incoming request
 * @returns A response indicating if the user is connected to YouTube Music
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized', connected: false },
        { status: 401 }
      );
    }
    
    // Check if we have a Google token in the session first
    const hasGoogleToken = !!session.user.googleAccessToken;
    
    try {
      // Try to connect to the database
      await connectToDatabase();
      
      // Find the user and check for a YouTube connection
      const user = await User.findById(session.user.id);
      
      if (!user) {
        return NextResponse.json(
          { error: 'User not found', connected: false },
          { status: 404 }
        );
      }
      
      // Check if the user has a Google/YouTube connection
      const youtubeConnection = user.accounts.find(
        (account: any) => account.platform === 'google'
      );
      
      return NextResponse.json({
        connected: !!youtubeConnection && hasGoogleToken,
        platformId: youtubeConnection?.platformId || null
      });
    } catch (dbError) {
      // If we have a database error but have a token, we can still respond
      if (isDatabaseError(dbError) && hasGoogleToken) {
        console.warn('Database error in YouTube connection check, using token from session:', dbError);
        return NextResponse.json({
          connected: hasGoogleToken,
          platformId: null,
          offlineMode: true,
          message: 'Database connection issue. Using session data only.'
        });
      }
      
      // For other errors, rethrow
      throw dbError;
    }
  } catch (error) {
    console.error('Error checking YouTube Music connection:', error);
    
    // Check if this is a database connection error
    if (isDatabaseError(error)) {
      return NextResponse.json(
        { 
          error: 'Database connection issue. Some features may be limited.', 
          connected: false,
          isDatabaseError: true 
        },
        { status: 503 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to check YouTube Music connection', connected: false },
      { status: 500 }
    );
  }
}

/**
 * Disconnects YouTube Music from the user's account
 * 
 * @param req - The incoming request
 * @returns A response indicating the result of the disconnection
 */
export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    try {
      await connectToDatabase();
      
      // Update the user by removing the YouTube connection
      const result = await User.updateOne(
        { _id: new ObjectId(session.user.id) },
        { $pull: { accounts: { platform: 'google' } } }
      );
      
      if (result.modifiedCount === 0) {
        return NextResponse.json(
          { error: 'Failed to disconnect YouTube Music or no connection found' },
          { status: 400 }
        );
      }
      
      return NextResponse.json({ success: true });
    } catch (dbError) {
      // Handle database errors
      if (isDatabaseError(dbError)) {
        console.warn('Database error in YouTube disconnection, using session-only mode:', dbError);
        return NextResponse.json({
          success: false,
          error: 'Database connection issue. Please try again later.',
          offlineMode: true
        });
      }
      
      // For other errors, rethrow
      throw dbError;
    }
  } catch (error) {
    console.error('Error disconnecting YouTube Music:', error);
    return NextResponse.json(
      { error: 'Failed to disconnect YouTube Music' },
      { status: 500 }
    );
  }
}

/**
 * Connects a user to YouTube Music
 * 
 * @param req - The incoming request with YouTube account details
 * @returns A response indicating the success of the connection
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    const body = await req.json();
    const { youtubeUserId } = body;
    
    if (!youtubeUserId) {
      return NextResponse.json(
        { error: 'YouTube user ID is required' },
        { status: 400 }
      );
    }
    
    if (!session.user.googleAccessToken) {
      return NextResponse.json(
        { error: 'No Google access token available. Please log in with Google first.' },
        { status: 400 }
      );
    }
    
    try {
      await connectToDatabase();
      
      // Update the user by setting the platformId for the Google account
      const result = await User.updateOne(
        { 
          _id: new ObjectId(session.user.id),
          "accounts.platform": "google" 
        },
        {
          $set: {
            "accounts.$.platformId": youtubeUserId,
            "accounts.$.updatedAt": new Date()
          }
        }
      );
      
      // If no document was modified, add a new Google account to the user
      if (result.matchedCount === 0 || result.modifiedCount === 0) {
        await User.updateOne(
          { _id: new ObjectId(session.user.id) },
          {
            $addToSet: {
              accounts: {
                platform: "google",
                platformId: youtubeUserId,
                createdAt: new Date(),
                updatedAt: new Date()
              }
            }
          }
        );
      }
      
      return NextResponse.json({
        success: true,
        message: 'Successfully connected to YouTube Music'
      });
    } catch (dbError) {
      // Handle database errors
      if (isDatabaseError(dbError)) {
        console.warn('Database error in YouTube connection, using session-only mode:', dbError);
        // If we have a database error but have the token, we can still consider it a success
        return NextResponse.json({
          success: true,
          message: 'Connected to YouTube Music in offline mode. Some features may be limited.',
          offlineMode: true
        });
      }
      
      // For other errors, rethrow
      throw dbError;
    }
  } catch (error) {
    console.error('Error connecting to YouTube Music:', error);
    
    // Check if this is a database connection error
    if (isDatabaseError(error)) {
      return NextResponse.json({
        success: false,
        error: 'Database connection issue. Some features may be limited.',
        isDatabaseError: true
      }, { status: 503 });
    }
    
    return NextResponse.json(
      { error: 'Failed to connect to YouTube Music' },
      { status: 500 }
    );
  }
} 