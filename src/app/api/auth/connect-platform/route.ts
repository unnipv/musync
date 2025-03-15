import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { ObjectId } from 'mongodb';
import authOptions from '@/lib/auth';
import dbConnect from '@/lib/mongoose';
import Playlist from '@/lib/models/playlist';

/**
 * Connects a streaming platform to a playlist after authentication
 * 
 * @param request - The incoming request with platform and playlist data
 * @returns A redirect to the playlist page or an error response
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
    
    const searchParams = request.nextUrl.searchParams;
    const platform = searchParams.get('platform');
    const playlistId = searchParams.get('playlistId');
    
    if (!platform || !['spotify', 'youtube'].includes(platform)) {
      return NextResponse.json({ error: 'Invalid platform' }, { status: 400 });
    }
    
    if (!playlistId || !ObjectId.isValid(playlistId)) {
      return NextResponse.json({ error: 'Invalid playlist ID' }, { status: 400 });
    }
    
    await dbConnect();
    
    // Find the playlist and ensure it belongs to the current user
    const playlist = await Playlist.findOne({
      _id: playlistId,
      userId: session.user.id
    });
    
    if (!playlist) {
      return NextResponse.json({ error: 'Playlist not found' }, { status: 404 });
    }
    
    // Connect the platform
    if (platform === 'spotify' && session.accessToken) {
      // Create a Spotify playlist if it doesn't exist
      const spotifyPlaylistId = await createOrGetSpotifyPlaylist(
        playlist.name || playlist.title,
        playlist.description,
        session.accessToken
      );
      
      // Update the playlist with Spotify data
      if (spotifyPlaylistId) {
        playlist.spotifyId = spotifyPlaylistId;
        
        // Update or add to platformData
        if (!playlist.platformData) {
          playlist.platformData = [];
        }
        
        const existingPlatformIndex = playlist.platformData.findIndex(
          (p: any) => p.platform === 'spotify'
        );
        
        if (existingPlatformIndex >= 0) {
          playlist.platformData[existingPlatformIndex] = {
            platform: 'spotify',
            platformId: spotifyPlaylistId,
            syncStatus: 'pending',
            lastSyncedAt: null
          };
        } else {
          playlist.platformData.push({
            platform: 'spotify',
            platformId: spotifyPlaylistId,
            syncStatus: 'pending',
            lastSyncedAt: null
          });
        }
        
        await playlist.save();
      }
    }
    
    // Redirect back to the playlist page
    return NextResponse.redirect(new URL(`/playlists/${playlistId}`, request.url));
  } catch (error) {
    console.error('Error connecting platform:', error);
    return NextResponse.json(
      { error: 'Failed to connect platform', details: (error as Error).message },
      { status: 500 }
    );
  }
}

/**
 * Creates a new Spotify playlist or gets an existing one
 * 
 * @param name - The name of the playlist
 * @param description - The description of the playlist
 * @param accessToken - The Spotify access token
 * @returns The Spotify playlist ID or null if creation failed
 */
async function createOrGetSpotifyPlaylist(
  name: string,
  description: string,
  accessToken: string
): Promise<string | null> {
  try {
    // First, get the user's Spotify ID
    const userResponse = await fetch('https://api.spotify.com/v1/me', {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });
    
    if (!userResponse.ok) {
      throw new Error(`Failed to get Spotify user: ${userResponse.statusText}`);
    }
    
    const userData = await userResponse.json();
    const userId = userData.id;
    
    // Create a new playlist
    const createResponse = await fetch(
      `https://api.spotify.com/v1/users/${userId}/playlists`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: `Musync: ${name}`,
          description: description || 'Created with Musync',
          public: false
        })
      }
    );
    
    if (!createResponse.ok) {
      throw new Error(`Failed to create Spotify playlist: ${createResponse.statusText}`);
    }
    
    const playlistData = await createResponse.json();
    return playlistData.id;
  } catch (error) {
    console.error('Error creating Spotify playlist:', error);
    return null;
  }
} 