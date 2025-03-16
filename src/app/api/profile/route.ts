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
    
    // Check platform connections from user accounts
    const platforms = [];
    
    // Check if user has Spotify connection
    const spotifyAccount = user.accounts?.find(
      (acc: any) => acc.platform === 'spotify'
    );
    
    if (spotifyAccount) {
      platforms.push({
        name: 'spotify',
        userId: spotifyAccount.platformId,
        connected: true,
        lastSyncedAt: spotifyAccount.lastSyncedAt || null
      });
    }
    
    // Check if user has Google/YouTube connection
    const googleAccount = user.accounts?.find(
      (acc: any) => acc.platform === 'google'
    );
    
    if (googleAccount) {
      platforms.push({
        name: 'youtube',
        userId: googleAccount.platformId,
        connected: true,
        lastSyncedAt: googleAccount.lastSyncedAt || null
      });
    }
    
    // Get user playlists count
    const playlistsCount = await db.collection('playlists')
      .countDocuments({ userId: new ObjectId(session.user.id) });
    
    // Get user playlists
    const playlists = await db.collection('playlists')
      .find({ userId: new ObjectId(session.user.id) })
      .project({
        _id: 1,
        name: 1,
        title: 1,
        description: 1,
        tracks: { $size: "$tracks" }
      })
      .toArray();
    
    return NextResponse.json({
      name: user.name,
      email: user.email,
      image: user.image || null,
      platforms,
      playlists: playlists.map((p: any) => ({
        _id: p._id,
        name: p.title || p.name,
        description: p.description || '',
        trackCount: p.tracks || 0
      }))
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