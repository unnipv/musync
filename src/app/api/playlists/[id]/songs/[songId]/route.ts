import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { ObjectId } from 'mongodb';
import authOptions from '@/lib/auth';
import dbConnect from '@/lib/mongoose';
import Playlist from '@/lib/models/playlist';

/**
 * Deletes a song from a playlist
 * 
 * @param request - The incoming request object
 * @param params - The route parameters containing the playlist ID and song ID
 * @returns A response with the updated playlist or an error
 */
export async function DELETE(
  request: Request,
  { params }: { params: { id: string; songId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
    
    // Check if the playlist has tracks array
    if (!playlist.tracks) {
      return NextResponse.json({ error: 'Playlist has no tracks' }, { status: 404 });
    }
    
    // Find the song in the tracks array
    const trackIndex = playlist.tracks.findIndex(
      (track: any) => track._id.toString() === params.songId
    );
    
    if (trackIndex === -1) {
      return NextResponse.json({ error: 'Song not found in playlist' }, { status: 404 });
    }
    
    // Remove the song from the tracks array
    playlist.tracks.splice(trackIndex, 1);
    
    // Update the playlist's lastSyncedAt to indicate it needs syncing
    if (playlist.platformData && playlist.platformData.length > 0) {
      playlist.platformData.forEach((platform: any) => {
        platform.syncStatus = 'pending';
      });
    }
    
    // Save the updated playlist
    await playlist.save();
    
    return NextResponse.json({ 
      message: 'Song removed successfully',
      playlist: JSON.parse(JSON.stringify(playlist))
    });
  } catch (error) {
    console.error('Error removing song:', error);
    return NextResponse.json(
      { error: 'Failed to remove song', details: (error as Error).message },
      { status: 500 }
    );
  }
} 