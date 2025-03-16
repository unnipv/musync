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

/**
 * Handles GET requests for connecting a playlist to a streaming platform
 * This is used as a callback after OAuth authentication
 * 
 * @param req - The incoming request with platform and playlist details
 * @returns Redirects to the playlist page or connect page
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user) {
      return NextResponse.redirect(new URL('/api/auth/signin', req.url));
    }
    
    // Get query parameters
    const url = new URL(req.url);
    const platform = url.searchParams.get('platform');
    const playlistId = url.searchParams.get('playlistId');
    
    if (!platform || !playlistId) {
      return NextResponse.redirect(new URL('/playlists', req.url));
    }
    
    if (!['spotify', 'youtube'].includes(platform)) {
      return NextResponse.redirect(new URL(`/playlists/${playlistId}/connect`, req.url));
    }
    
    // For Spotify, we need to get the user's Spotify ID from the session
    if (platform === 'spotify' && session.accessToken) {
      try {
        // Get the Spotify user profile
        const spotifyResponse = await fetch('https://api.spotify.com/v1/me', {
          headers: {
            Authorization: `Bearer ${session.accessToken}`
          }
        });
        
        if (!spotifyResponse.ok) {
          console.error('Failed to get Spotify profile:', await spotifyResponse.text());
          return NextResponse.redirect(new URL(`/playlists/${playlistId}/connect?error=spotify_profile`, req.url));
        }
        
        const spotifyProfile = await spotifyResponse.json();
        const spotifyUserId = spotifyProfile.id;
        
        // Connect the platform to the user
        await connectToDatabase();
        
        // Update user with platform connection
        const user = await User.findById(session.user.id);
        
        if (!user) {
          return NextResponse.redirect(new URL(`/playlists/${playlistId}/connect?error=user_not_found`, req.url));
        }
        
        // Check if platform is already connected
        const platformExists = user.platforms?.some((p: { name: string }) => p.name === platform);
        
        if (user.platforms && platformExists) {
          // Update existing platform connection
          const platformIndex = user.platforms.findIndex((p: { name: string }) => p.name === platform);
          user.platforms[platformIndex].userId = spotifyUserId;
          user.platforms[platformIndex].lastSyncedAt = new Date();
        } else {
          // Initialize platforms array if it doesn't exist
          if (!user.platforms) {
            user.platforms = [];
          }
          
          // Add new platform connection
          user.platforms.push({
            name: platform,
            userId: spotifyUserId,
            lastSyncedAt: new Date()
          });
        }
        
        // For backward compatibility
        if (platform === 'spotify') {
          user.spotifyId = spotifyUserId;
        }
        
        await user.save();
        
        // Connect the platform to the playlist
        const playlist = await Playlist.findById(playlistId);
        
        if (playlist && playlist.userId.toString() === session.user.id) {
          // Check if platformData exists
          if (!playlist.platformData) {
            playlist.platformData = [];
          }
          
          // Check if this platform is already connected to the playlist
          const platformDataExists = playlist.platformData.some(
            (p: { platform: string }) => p.platform === platform
          );
          
          if (platformDataExists) {
            // Update existing platform data
            const platformIndex = playlist.platformData.findIndex(
              (p: { platform: string }) => p.platform === platform
            );
            
            playlist.platformData[platformIndex].syncStatus = 'pending';
            playlist.platformData[platformIndex].lastSyncedAt = new Date();
          } else {
            // Create a new Spotify playlist
            try {
              // Check if this playlist was imported from Spotify
              if (playlist.spotifyId) {
                console.log(`Playlist was imported from Spotify with ID: ${playlist.spotifyId}`);
                
                // Use the existing Spotify playlist ID
                const spotifyPlaylistId = playlist.spotifyId;
                
                // Add platform data with the existing Spotify playlist ID
                playlist.platformData.push({
                  platform,
                  id: spotifyPlaylistId,
                  platformId: spotifyPlaylistId,
                  syncStatus: 'pending',
                  lastSyncedAt: new Date()
                });
                
                // Also update the playlist's spotifyId field if it's different
                if (playlist.spotifyId !== spotifyPlaylistId) {
                  playlist.spotifyId = spotifyPlaylistId;
                }
                
                console.log(`Using existing Spotify playlist ID ${spotifyPlaylistId} for Musync playlist ${playlistId}`);
              } else {
                // Create a new Spotify playlist
                const createPlaylistResponse = await fetch(
                  `https://api.spotify.com/v1/users/${spotifyUserId}/playlists`,
                  {
                    method: 'POST',
                    headers: {
                      Authorization: `Bearer ${session.accessToken}`,
                      'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                      name: playlist.title || playlist.name || 'My Playlist',
                      description: playlist.description || '',
                      public: false
                    })
                  }
                );
                
                if (!createPlaylistResponse.ok) {
                  const errorText = await createPlaylistResponse.text();
                  console.error('Failed to create Spotify playlist:', errorText);
                  return NextResponse.redirect(new URL(`/playlists/${playlistId}/connect?error=spotify_create_playlist&details=${encodeURIComponent(errorText)}`, req.url));
                }
                
                const spotifyPlaylist = await createPlaylistResponse.json();
                const spotifyPlaylistId = spotifyPlaylist.id;
                
                // Add new platform data with the created playlist ID
                playlist.platformData.push({
                  platform,
                  id: spotifyPlaylistId,
                  platformId: spotifyPlaylistId,
                  syncStatus: 'pending',
                  lastSyncedAt: new Date()
                });
                
                console.log(`Created Spotify playlist with ID ${spotifyPlaylistId} for Musync playlist ${playlistId}`);
              }
            } catch (error) {
              console.error('Error creating Spotify playlist:', error);
              return NextResponse.redirect(new URL(`/playlists/${playlistId}/connect?error=spotify_create_playlist&details=${encodeURIComponent(String(error))}`, req.url));
            }
          }
          
          await playlist.save();
          
          // Trigger an immediate sync
          try {
            const syncResponse = await fetch(`/api/playlists/${playlistId}/sync`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                platforms: [platform]
              })
            });
            
            if (!syncResponse.ok) {
              console.error('Failed to trigger sync:', await syncResponse.text());
            }
          } catch (error) {
            console.error('Error triggering sync:', error);
          }
        }
        
        // Redirect to the playlist page with success message
        return NextResponse.redirect(new URL(`/playlists/${playlistId}?connected=${platform}`, req.url));
      } catch (error) {
        console.error('Error connecting Spotify:', error);
        return NextResponse.redirect(new URL(`/playlists/${playlistId}/connect?error=connection_failed`, req.url));
      }
    }
    
    // For YouTube, similar implementation would go here
    
    // Default redirect back to the connect page
    return NextResponse.redirect(new URL(`/playlists/${playlistId}/connect`, req.url));
  } catch (error) {
    console.error('Error in connect-platform GET handler:', error);
    return NextResponse.redirect(new URL('/playlists', req.url));
  }
} 