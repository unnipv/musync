import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { ObjectId } from 'mongodb';
import authOptions from '@/lib/auth';
import dbConnect from '@/lib/mongoose';
import Playlist from '@/lib/models/playlist';

/**
 * Adds a song to a playlist
 * 
 * @param request - The incoming request with song data
 * @param params - The route parameters containing the playlist ID
 * @returns The updated playlist with the new song
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
    
    const songData = await request.json();
    
    // Validate required fields
    if (!songData.title || !songData.artist || !songData.platformId || !songData.platform) {
      return NextResponse.json(
        { error: 'Missing required fields: title, artist, platformId, platform' },
        { status: 400 }
      );
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
    
    // Check if the song already exists in the playlist
    if (playlist.tracks) {
      const songExists = playlist.tracks.some((track: any) => 
        (track.platformId === songData.platformId && track.platform === songData.platform) ||
        (songData.spotifyId && track.spotifyId === songData.spotifyId) ||
        (songData.youtubeId && track.youtubeId === songData.youtubeId)
      );
      
      if (songExists) {
        return NextResponse.json({ error: 'Song already exists in playlist' }, { status: 409 });
      }
    } else {
      // Initialize tracks array if it doesn't exist
      playlist.tracks = [];
    }
    
    // Add the song to the playlist
    const newSong = {
      title: songData.title,
      artist: songData.artist,
      album: songData.album || '',
      duration: songData.duration || 0,
      imageUrl: songData.imageUrl || '',
      platform: songData.platform,
      platformId: songData.platformId,
      spotifyId: songData.spotifyId || null,
      youtubeId: songData.youtubeId || null,
      addedAt: new Date()
    };
    
    playlist.tracks.push(newSong);
    
    // Update the playlist's sync status
    if (playlist.platformData && playlist.platformData.length > 0) {
      playlist.platformData.forEach((platform: any) => {
        platform.syncStatus = 'pending';
      });
    }
    
    // Save the updated playlist
    await playlist.save();
    
    return NextResponse.json({
      message: 'Song added successfully',
      song: newSong,
      playlist: JSON.parse(JSON.stringify(playlist))
    });
  } catch (error) {
    console.error('Error adding song to playlist:', error);
    return NextResponse.json(
      { error: 'Failed to add song to playlist', details: (error as Error).message },
      { status: 500 }
    );
  }
} 