import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { ObjectId } from 'mongodb';
import authOptions from '@/lib/auth';
import dbConnect from '@/lib/mongoose';
import Playlist from '@/lib/models/playlist';

/**
 * Disconnects a streaming platform from a playlist
 * 
 * @param request - The incoming request with platform data
 * @param params - The route parameters containing the playlist ID
 * @returns A response indicating success or failure
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    if (!ObjectId.isValid(params.id)) {
      return NextResponse.json({ error: 'Invalid playlist ID' }, { status: 400 });
    }
    
    const { platform } = await request.json();
    
    if (!platform || !['spotify', 'youtube'].includes(platform)) {
      return NextResponse.json({ error: 'Invalid platform' }, { status: 400 });
    }
    
    await dbConnect();
    
    // Find the playlist and ensure it belongs to the current user
    const playlist = await Playlist.findOne({
      _id: params.id,
      userId: session.user.id
    });
    
    if (!playlist) {
      return NextResponse.json({ error: 'Playlist not found' }, { status: 404 });
    }
    
    // Remove the platform from platformData
    if (playlist.platformData && playlist.platformData.length > 0) {
      playlist.platformData = playlist.platformData.filter(
        (p: any) => p.platform !== platform
      );
    }
    
    // Clear platform-specific IDs
    if (platform === 'spotify') {
      playlist.spotifyId = null;
    } else if (platform === 'youtube') {
      playlist.youtubeId = null;
    }
    
    // Save the updated playlist
    await playlist.save();
    
    return NextResponse.json({
      message: `Successfully disconnected from ${platform}`,
      playlist: JSON.parse(JSON.stringify(playlist))
    });
  } catch (error) {
    console.error('Error disconnecting platform:', error);
    return NextResponse.json(
      { error: 'Failed to disconnect platform', details: (error as Error).message },
      { status: 500 }
    );
  }
} 