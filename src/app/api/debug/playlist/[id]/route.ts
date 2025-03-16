import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

interface Playlist {
  _id: ObjectId;
  userId: ObjectId;
  name: string;
  description?: string;
  isPublic: boolean;
  tracks: any[];
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Retrieves detailed information about a specific playlist for debugging purposes
 * @param request - The incoming request
 * @param params - Object containing the playlist ID
 * @returns JSON response with playlist details or error
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { id } = params;
    
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid playlist ID' }, { status: 400 });
    }
    
    const { db } = await connectToDatabase();
    
    const playlist = await db.collection('playlists').findOne({ _id: new ObjectId(id) }) as Playlist;
    
    if (!playlist) {
      return NextResponse.json({ error: 'Playlist not found' }, { status: 404 });
    }
    
    if (playlist.userId.toString() !== session.user.id && !playlist.isPublic) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }
    
    // Get user info
    const user = await db.collection('users').findOne({ _id: playlist.userId });
    
    // Get platform connections
    const platforms = await db.collection('userPlatforms')
      .find({ userId: playlist.userId })
      .toArray();
    
    return NextResponse.json({
      playlist,
      user: {
        _id: user?._id,
        name: user?.name,
        email: user?.email,
        image: user?.image
      },
      platforms: platforms.map((p: any) => ({
        platform: p.platform,
        platformId: p.platformId,
        connected: !!p.platformId
      }))
    });
  } catch (error) {
    console.error('Error in debug playlist route:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve playlist details', details: String(error) },
      { status: 500 }
    );
  }
} 