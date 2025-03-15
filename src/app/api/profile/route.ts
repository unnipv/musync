import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

/**
 * Retrieves the user profile for the authenticated user
 * @param req - The incoming request
 * @returns JSON response with user profile data
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    console.log('Profile API - Session:', {
      userId: session.user.id,
      hasAccessToken: !!session.accessToken,
      user: session.user
    });
    
    const { db } = await connectToDatabase();
    
    // Get user from database
    const user = await db.collection('users').findOne({
      _id: new ObjectId(session.user.id)
    });
    
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }
    
    // Get connected platforms
    const platforms = await db.collection('userPlatforms')
      .find({ userId: new ObjectId(session.user.id) })
      .toArray();
    
    // Get user playlists count
    const playlistsCount = await db.collection('playlists')
      .countDocuments({ userId: new ObjectId(session.user.id) });
    
    return NextResponse.json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        image: user.image
      },
      platforms: platforms.map(p => ({
        platform: p.platform,
        connected: !!p.platformId
      })),
      stats: {
        playlists: playlistsCount
      }
    });
  } catch (error) {
    console.error('Error fetching profile:', error);
    return NextResponse.json(
      { error: 'Failed to fetch profile', details: String(error) },
      { status: 500 }
    );
  }
}

/**
 * Updates the user profile for the authenticated user
 * @param req - The incoming request with profile update data
 * @returns JSON response indicating success or failure
 */
export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    const body = await req.json();
    const { name } = body;
    
    if (!name) {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      );
    }
    
    const { db } = await connectToDatabase();
    
    // Update user in database
    const result = await db.collection('users').updateOne(
      { _id: new ObjectId(session.user.id) },
      { $set: { name, updatedAt: new Date() } }
    );
    
    if (result.matchedCount === 0) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      success: true,
      message: 'Profile updated successfully'
    });
  } catch (error) {
    console.error('Error updating profile:', error);
    return NextResponse.json(
      { error: 'Failed to update profile', details: String(error) },
      { status: 500 }
    );
  }
} 