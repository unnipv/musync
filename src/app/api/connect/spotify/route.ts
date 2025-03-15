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
    
    // Check if the user has a Spotify connection
    const userPlatform = await db.collection('userPlatforms').findOne({
      userId: new ObjectId(session.user.id),
      platform: 'spotify'
    });
    
    return NextResponse.json({
      connected: !!userPlatform,
      platformId: userPlatform?.platformId || null
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
    
    // Store the Spotify connection
    await db.collection('userPlatforms').updateOne(
      {
        userId: new ObjectId(session.user.id),
        platform: 'spotify'
      },
      {
        $set: {
          platformId: spotifyUserId,
          updatedAt: new Date()
        },
        $setOnInsert: {
          createdAt: new Date()
        }
      },
      { upsert: true }
    );
    
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