import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { ObjectId } from 'mongodb';
import authOptions from '@/lib/auth';
import dbConnect from '@/lib/mongoose';
import Playlist from '@/lib/models/playlist';

/**
 * Synchronizes a playlist with connected streaming platforms
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
    
    const { platforms = ['spotify', 'youtube'] } = await request.json();
    
    await dbConnect();
    
    // Find the playlist and ensure it belongs to the current user
    const playlist = await Playlist.findOne({
      _id: params.id,
      userId: session.userId
    });
    
    if (!playlist) {
      return NextResponse.json({ error: 'Playlist not found' }, { status: 404 });
    }
    
    // Check if the playlist has tracks
    if (!playlist.tracks || playlist.tracks.length === 0) {
      return NextResponse.json({ error: 'Playlist has no tracks to sync' }, { status: 400 });
    }
    
    const results = {
      spotify: { success: false, message: 'Not synced' },
      youtube: { success: false, message: 'Not synced' }
    };
    
    // Sync with Spotify if requested and connected
    if (platforms.includes('spotify') && playlist.spotifyId && session.accessToken) {
      try {
        await syncWithSpotify(playlist, session.accessToken);
        
        // Update the sync status in platformData
        if (playlist.platformData) {
          const spotifyPlatform = playlist.platformData.find(
            (p: any) => p.platform === 'spotify'
          );
          
          if (spotifyPlatform) {
            spotifyPlatform.syncStatus = 'synced';
            spotifyPlatform.lastSyncedAt = new Date();
          }
        }
        
        results.spotify = { success: true, message: 'Synced successfully' };
      } catch (error) {
        console.error('Error syncing with Spotify:', error);
        results.spotify = { 
          success: false, 
          message: `Failed to sync: ${error instanceof Error ? error.message : 'Unknown error'}` 
        };
      }
    }
    
    // Sync with YouTube if requested and connected (placeholder for now)
    if (platforms.includes('youtube') && playlist.youtubeId) {
      // This would be implemented similarly to Spotify
      // For now, we'll just update the status
      if (playlist.platformData) {
        const youtubePlatform = playlist.platformData.find(
          (p: any) => p.platform === 'youtube'
        );
        
        if (youtubePlatform) {
          youtubePlatform.syncStatus = 'synced';
          youtubePlatform.lastSyncedAt = new Date();
        }
      }
      
      results.youtube = { 
        success: true, 
        message: 'YouTube sync is not fully implemented yet, but status updated' 
      };
    }
    
    // Save the updated playlist
    await playlist.save();
    
    return NextResponse.json({
      message: 'Playlist sync completed',
      results,
      playlist: JSON.parse(JSON.stringify(playlist))
    });
  } catch (error) {
    console.error('Error syncing playlist:', error);
    return NextResponse.json(
      { error: 'Failed to sync playlist', details: (error as Error).message },
      { status: 500 }
    );
  }
}

/**
 * Synchronizes a playlist with Spotify
 * 
 * @param playlist - The playlist to sync
 * @param accessToken - The Spotify access token
 */
async function syncWithSpotify(playlist: any, accessToken: string) {
  // Get the current tracks in the Spotify playlist
  const currentTracksResponse = await fetch(
    `https://api.spotify.com/v1/playlists/${playlist.spotifyId}/tracks`,
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    }
  );
  
  if (!currentTracksResponse.ok) {
    throw new Error(`Failed to get Spotify tracks: ${currentTracksResponse.statusText}`);
  }
  
  const currentTracksData = await currentTracksResponse.json();
  
  // Clear the current tracks from the Spotify playlist
  if (currentTracksData.items.length > 0) {
    const trackUris = currentTracksData.items.map((item: any) => ({ uri: item.track.uri }));
    
    const clearResponse = await fetch(
      `https://api.spotify.com/v1/playlists/${playlist.spotifyId}/tracks`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ tracks: trackUris })
      }
    );
    
    if (!clearResponse.ok) {
      throw new Error(`Failed to clear Spotify playlist: ${clearResponse.statusText}`);
    }
  }
  
  // Add the tracks from our playlist to Spotify
  const spotifyTracks = playlist.tracks
    .filter((track: any) => track.spotifyId || (track.platform === 'spotify' && track.platformId))
    .map((track: any) => {
      const trackId = track.spotifyId || track.platformId;
      return `spotify:track:${trackId}`;
    });
  
  if (spotifyTracks.length > 0) {
    // Spotify API limits to 100 tracks per request, so we need to chunk
    const chunkSize = 100;
    for (let i = 0; i < spotifyTracks.length; i += chunkSize) {
      const chunk = spotifyTracks.slice(i, i + chunkSize);
      
      const addResponse = await fetch(
        `https://api.spotify.com/v1/playlists/${playlist.spotifyId}/tracks`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ uris: chunk })
        }
      );
      
      if (!addResponse.ok) {
        throw new Error(`Failed to add tracks to Spotify playlist: ${addResponse.statusText}`);
      }
    }
  }
} 