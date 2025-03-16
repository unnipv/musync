import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

/**
 * Checks if the user is connected to Spotify
 * 
 * @param req - The incoming request
 * @returns A response indicating if the user is connected to Spotify
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
    
    const { db } = await connectToDatabase();
    
    // Check if the user has a Spotify account in the accounts array
    const user = await db.collection('users').findOne({
      _id: new ObjectId(session.user.id)
    });
    
    if (!user) {
      return NextResponse.json(
        { error: 'User not found', connected: false },
        { status: 404 }
      );
    }
    
    // Check if the user has a Spotify account
    const spotifyAccount = user.accounts?.find(
      (acc: any) => acc.platform === 'spotify'
    );
    
    return NextResponse.json({
      connected: !!spotifyAccount,
      platformId: spotifyAccount?.platformId || null
    });
  } catch (error) {
    console.error('Error checking Spotify connection:', error);
    return NextResponse.json(
      { error: 'Failed to check Spotify connection', connected: false },
      { status: 500 }
    );
  }
}

/**
 * Connects a user to Spotify
 * 
 * @param req - The incoming request with Spotify account details
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
    const { spotifyUserId } = body;
    
    if (!spotifyUserId) {
      return NextResponse.json(
        { error: 'Spotify user ID is required' },
        { status: 400 }
      );
    }
    
    const { db } = await connectToDatabase();
    
    // Update the user document with the Spotify account information
    const result = await db.collection('users').updateOne(
      { _id: new ObjectId(session.user.id) },
      {
        $set: {
          "accounts.$[elem].platformId": spotifyUserId,
          "accounts.$[elem].updatedAt": new Date()
        }
      },
      {
        arrayFilters: [{ "elem.platform": "spotify" }]
      }
    );
    
    // If no document was modified, it means the user doesn't have a Spotify account yet
    if (result.matchedCount === 0 || result.modifiedCount === 0) {
      // Add a new Spotify account to the user
      await db.collection('users').updateOne(
        { _id: new ObjectId(session.user.id) },
        {
          $addToSet: {
            accounts: {
              platform: "spotify",
              platformId: spotifyUserId,
              updatedAt: new Date(),
              createdAt: new Date()
            }
          }
        }
      );
    }
    
    return NextResponse.json({
      success: true,
      message: 'Successfully connected to Spotify'
    });
  } catch (error) {
    console.error('Error connecting to Spotify:', error);
    return NextResponse.json(
      { error: 'Failed to connect to Spotify' },
      { status: 500 }
    );
  }
} 