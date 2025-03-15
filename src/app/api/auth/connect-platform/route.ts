import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { ObjectId } from 'mongodb';
import { authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/mongodb';
import Playlist from '@/lib/models/playlist';
import User from '@/lib/models/user';

/**
 * Connects a playlist to a streaming platform
 * 
 * @param req - The incoming request with platform details
 * @returns JSON response with connection status
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { platform, platformUserId, platformUserName, playlists } = await req.json();
    
    if (!platform || !['spotify', 'youtube'].includes(platform)) {
      return NextResponse.json({ error: 'Invalid platform' }, { status: 400 });
    }
    
    if (!platformUserId) {
      return NextResponse.json({ error: 'Platform user ID is required' }, { status: 400 });
    }
    
    await connectToDatabase();
    
    // Update user with platform connection
    const user = await User.findById(session.user.id);
    
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    
    // Check if platform is already connected
    const platformExists = user.platforms.some((p: { name: string }) => p.name === platform);
    
    if (platformExists) {
      // Update existing platform connection
      const platformIndex = user.platforms.findIndex((p: { name: string }) => p.name === platform);
      user.platforms[platformIndex].userId = platformUserId;
      user.platforms[platformIndex].lastSyncedAt = new Date();
    } else {
      // Add new platform connection
      user.platforms.push({
        name: platform,
        userId: platformUserId,
        lastSyncedAt: new Date()
      });
    }
    
    // For backward compatibility
    if (platform === 'spotify') {
      user.spotifyId = platformUserId;
    } else if (platform === 'youtube') {
      user.youtubeId = platformUserId;
    }
    
    await user.save();
    
    // If playlists were provided, create or update them
    if (playlists && Array.isArray(playlists)) {
      for (const playlistData of playlists) {
        const { id: spotifyPlaylistId, name, description, tracks } = playlistData;
        
        // Check if playlist already exists
        let playlist = await Playlist.findOne({
          userId: user._id,
          [`${platform}Id`]: spotifyPlaylistId
        });
        
        if (!playlist) {
          // Create new playlist
          playlist = new Playlist({
            userId: user._id,
            title: name,
            description: description || '',
            tracks: [],
            platformData: []
          });
          
          // Set platform-specific ID
          if (platform === 'spotify') {
            playlist.spotifyId = spotifyPlaylistId;
          } else if (platform === 'youtube') {
            playlist.youtubeId = spotifyPlaylistId;
          }
        }
        
        // Add the platform data to the playlist
        if (!playlist.platformData) {
          playlist.platformData = [];
        }
        
        playlist.platformData.push({
          platform: 'spotify',
          id: spotifyPlaylistId,
          lastSyncedAt: new Date()
        });
        
        // Add tracks if provided
        if (tracks && Array.isArray(tracks)) {
          for (const track of tracks) {
            const { id, name, artist, album, duration_ms } = track;
            
            // Check if track already exists in playlist
            const trackExists = playlist.tracks.some(t => 
              (platform === 'spotify' && t.spotifyId === id) || 
              (platform === 'youtube' && t.youtubeId === id)
            );
            
            if (!trackExists) {
              const trackData: TrackData = {
                title: track.name,
                artist: track.artists ? track.artists.map((a: any) => a.name).join(', ') : 'Unknown Artist',
                album: track.album?.name || 'Unknown Album',
                duration: track.duration_ms ? Math.floor(track.duration_ms / 1000) : undefined,
                addedAt: new Date(),
              };
              
              // Set platform-specific track ID
              if (platform === 'spotify') {
                trackData.spotifyId = id;
              } else if (platform === 'youtube') {
                trackData.youtubeId = id;
              }
              
              playlist.tracks.push(trackData);
            }
          }
        }
        
        await playlist.save();
      }
    }
    
    return NextResponse.json({
      success: true,
      message: `Successfully connected ${platform} account`,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        platforms: user.platforms
      }
    });
  } catch (error) {
    console.error('Error connecting platform:', error);
    return NextResponse.json(
      { error: 'Failed to connect platform', details: (error as Error).message },
      { status: 500 }
    );
  }
}

/**
 * Creates or gets a Spotify playlist
 * 
 * @param name - The playlist name
 * @param description - The playlist description
 * @param accessToken - The Spotify access token
 * @returns The Spotify playlist ID
 */
async function createOrGetSpotifyPlaylist(
  name: string,
  description: string,
  accessToken: string
): Promise<string> {
  try {
    // Get the current user's Spotify ID
    const userResponse = await fetch('https://api.spotify.com/v1/me', {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });
    
    if (!userResponse.ok) {
      throw new Error('Failed to get Spotify user profile');
    }
    
    const userData = await userResponse.json();
    const userId = userData.id;
    
    // Create a new playlist
    const response = await fetch(
      `https://api.spotify.com/v1/users/${userId}/playlists`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name,
          description,
          public: false
        })
      }
    );
    
    if (!response.ok) {
      throw new Error('Failed to create Spotify playlist');
    }
    
    const data = await response.json();
    return data.id;
  } catch (error) {
    console.error('Error creating Spotify playlist:', error);
    throw error;
  }
}

// Add type definitions for trackData
interface TrackData {
  title: any;
  artist: any;
  album: any;
  duration: number | undefined;
  addedAt: Date;
  spotifyId?: string;
  youtubeId?: string;
} 