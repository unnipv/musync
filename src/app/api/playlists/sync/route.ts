import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/mongodb';
import Playlist from '@/models/Playlist';
import { synchronizeWithAllPlatforms, synchronizeWithPlatform } from '@/lib/services/syncService';
import { SpotifyService } from '@/lib/services/spotify';
import { YouTubeService } from '@/lib/services/youtube';
import { 
  createSpotifyPlaylist, 
  createYouTubePlaylist,
  addTracksToSpotify,
  addTracksToYouTube 
} from '@/lib/services/platformServices';

/**
 * Handles POST requests to synchronize a playlist between platforms
 * 
 * @param req - The incoming request
 * @returns API response with synchronization results
 */
export async function POST(req: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Connect to database
    await connectToDatabase();

    // Parse request body
    const body = await req.json();
    const { playlistId, platforms } = body;

    if (!playlistId) {
      return NextResponse.json(
        { error: 'Playlist ID is required' },
        { status: 400 }
      );
    }

    // Check if playlist exists and belongs to the user
    const playlist = await Playlist.findOne({
      _id: playlistId,
      userId: session.user.id
    });

    if (!playlist) {
      return NextResponse.json(
        { error: 'Playlist not found or access denied' },
        { status: 404 }
      );
    }

    // Get access tokens from session
    const userAccessTokens: Record<string, string> = {};
    
    if (session.user.spotifyAccessToken) {
      userAccessTokens.spotify = session.user.spotifyAccessToken;
    }
    
    if (session.user.googleAccessToken) {
      userAccessTokens.youtube = session.user.googleAccessToken;
    }
    
    let syncResults: Record<string, any> = {};
    
    // Perform synchronization based on requested platforms
    if (!platforms || platforms === 'all') {
      try {
        // Check which platforms need connection
        const needsSpotify = !playlist.spotifyId;
        const needsYoutube = !playlist.youtubeId;
        
        // Create playlists on platforms that need it
        if (needsSpotify && userAccessTokens.spotify) {
          console.log(`Creating Spotify playlist for ${playlist.name}`);
          
          const spotifyService = new SpotifyService(userAccessTokens.spotify);
          const createResult = await createSpotifyPlaylist(
            spotifyService,
            playlist.name,
            playlist.description || `Playlist synchronized from Musync`,
            playlist.isPublic
          );
          
          if (createResult.success && createResult.playlistId) {
            // Update playlist with Spotify ID
            await Playlist.findByIdAndUpdate(playlistId, {
              $set: { spotifyId: createResult.playlistId }
            });
            
            // Add tracks to the new Spotify playlist
            const addResult = await addTracksToSpotify(
              spotifyService,
              createResult.playlistId,
              playlist.tracks
            );
            
            syncResults.spotify = {
              success: addResult.success,
              created: true,
              added: addResult.tracksAdded || 0,
              unavailableTracks: addResult.unavailableTracks || [],
              playlistUrl: createResult.playlistUrl
            };
          } else {
            syncResults.spotify = {
              success: false,
              error: createResult.error || 'Failed to create Spotify playlist'
            };
          }
        }
        
        if (needsYoutube && userAccessTokens.youtube) {
          console.log(`Creating YouTube playlist for ${playlist.name}`);
          
          const youtubeService = new YouTubeService(userAccessTokens.youtube);
          const createResult = await createYouTubePlaylist(
            youtubeService,
            playlist.name,
            playlist.description || `Playlist synchronized from Musync`,
            playlist.isPublic
          );
          
          if (createResult.success && createResult.playlistId) {
            // Update playlist with YouTube ID
            await Playlist.findByIdAndUpdate(playlistId, {
              $set: { youtubeId: createResult.playlistId }
            });
            
            // Add tracks to the new YouTube playlist
            const addResult = await addTracksToYouTube(
              youtubeService,
              createResult.playlistId,
              playlist.tracks
            );
            
            syncResults.youtube = {
              success: addResult.success,
              created: true,
              added: addResult.tracksAdded || 0,
              unavailableTracks: addResult.unavailableTracks || [],
              playlistUrl: createResult.playlistUrl
            };
          } else {
            syncResults.youtube = {
              success: false,
              error: createResult.error || 'Failed to create YouTube playlist'
            };
          }
        }
        
        // Sync between existing platforms
        if ((playlist.spotifyId || needsSpotify) && (playlist.youtubeId || needsYoutube)) {
          // Reload the playlist to get updated platform IDs
          const updatedPlaylist = await Playlist.findById(playlistId);
          if (!updatedPlaylist) {
            return NextResponse.json(
              { error: 'Playlist not found after creation' },
              { status: 404 }
            );
          }
          
          // Sync between platforms
          const allResults = await synchronizeWithAllPlatforms(
            playlistId,
            userAccessTokens
          );
          
          // Combine results
          syncResults = {
            ...syncResults,
            ...allResults
          };
          
          // Update last synced timestamp
          await Playlist.findByIdAndUpdate(playlistId, {
            $set: { lastSyncedAt: new Date() }
          });
        }
      } catch (error) {
        console.error('Error in all-platform sync:', error);
        return NextResponse.json(
          { 
            error: 'Failed to synchronize with all platforms',
            details: error instanceof Error ? error.message : 'Unknown error'
          },
          { status: 500 }
        );
      }
    } else if (platforms === 'spotify') {
      // Ensure we have a Spotify access token
      if (!userAccessTokens.spotify) {
        return NextResponse.json(
          { error: 'No Spotify access token available' },
          { status: 400 }
        );
      }
      
      // Create Spotify playlist if needed
      if (!playlist.spotifyId) {
        console.log(`Creating Spotify playlist for ${playlist.name}`);
        
        const spotifyService = new SpotifyService(userAccessTokens.spotify);
        const createResult = await createSpotifyPlaylist(
          spotifyService,
          playlist.name,
          playlist.description || `Playlist synchronized from Musync`,
          playlist.isPublic
        );
        
        if (createResult.success && createResult.playlistId) {
          // Update playlist with Spotify ID
          await Playlist.findByIdAndUpdate(playlistId, {
            $set: { spotifyId: createResult.playlistId }
          });
          
          // Add tracks to the new Spotify playlist
          const addResult = await addTracksToSpotify(
            spotifyService,
            createResult.playlistId,
            playlist.tracks
          );
          
          syncResults.spotify = {
            success: addResult.success,
            created: true,
            added: addResult.tracksAdded || 0,
            unavailableTracks: addResult.unavailableTracks || [],
            playlistUrl: createResult.playlistUrl
          };
        } else {
          syncResults.spotify = {
            success: false,
            error: createResult.error || 'Failed to create Spotify playlist'
          };
        }
      } else {
        // Sync existing Spotify playlist
        const result = await synchronizeWithPlatform(
          playlistId,
          'spotify',
          userAccessTokens.spotify
        );
        
        syncResults.spotify = result;
      }
      
      // Update last synced timestamp
      await Playlist.findByIdAndUpdate(playlistId, {
        $set: { lastSyncedAt: new Date() }
      });
    } else if (platforms === 'youtube') {
      // Ensure we have a YouTube access token
      if (!userAccessTokens.youtube) {
        return NextResponse.json(
          { error: 'No YouTube access token available' },
          { status: 400 }
        );
      }
      
      // Create YouTube playlist if needed
      if (!playlist.youtubeId) {
        console.log(`Creating YouTube playlist for ${playlist.name}`);
        
        const youtubeService = new YouTubeService(userAccessTokens.youtube);
        const createResult = await createYouTubePlaylist(
          youtubeService,
          playlist.name,
          playlist.description || `Playlist synchronized from Musync`,
          playlist.isPublic
        );
        
        if (createResult.success && createResult.playlistId) {
          // Update playlist with YouTube ID
          await Playlist.findByIdAndUpdate(playlistId, {
            $set: { youtubeId: createResult.playlistId }
          });
          
          // Add tracks to the new YouTube playlist
          const addResult = await addTracksToYouTube(
            youtubeService,
            createResult.playlistId,
            playlist.tracks
          );
          
          syncResults.youtube = {
            success: addResult.success,
            created: true,
            added: addResult.tracksAdded || 0,
            unavailableTracks: addResult.unavailableTracks || [],
            playlistUrl: createResult.playlistUrl
          };
        } else {
          syncResults.youtube = {
            success: false,
            error: createResult.error || 'Failed to create YouTube playlist'
          };
        }
      } else {
        // Sync existing YouTube playlist
        const result = await synchronizeWithPlatform(
          playlistId,
          'youtube',
          userAccessTokens.youtube
        );
        
        syncResults.youtube = result;
      }
      
      // Update last synced timestamp
      await Playlist.findByIdAndUpdate(playlistId, {
        $set: { lastSyncedAt: new Date() }
      });
    } else {
      return NextResponse.json(
        { error: `Invalid platform: ${platforms}` },
        { status: 400 }
      );
    }

    // Check if synchronization was successful
    const hasErrors = Object.values(syncResults).some(result => !result.success);
    
    if (hasErrors) {
      // Return partial success with error details
      return NextResponse.json(
        { 
          success: false, 
          message: 'Synchronization completed with errors',
          results: syncResults
        },
        { status: 207 } // Multi-Status
      );
    }

    // Return success response
    return NextResponse.json({
      success: true,
      message: 'Playlist synchronized successfully',
      results: syncResults
    });
  } catch (error) {
    console.error('Error synchronizing playlist:', error);
    return NextResponse.json(
      { 
        error: 'Failed to synchronize playlist',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * Handles GET requests to check synchronization status
 * 
 * @param req - The incoming request
 * @returns API response with synchronization status
 */
export async function GET(req: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Connect to database
    await connectToDatabase();

    // Get playlist ID from URL
    const url = new URL(req.url);
    const playlistId = url.searchParams.get('playlistId');

    if (!playlistId) {
      return NextResponse.json(
        { error: 'Playlist ID is required' },
        { status: 400 }
      );
    }

    // Check if playlist exists and belongs to the user
    const playlist = await Playlist.findOne({
      _id: playlistId,
      userId: session.user.id
    });

    if (!playlist) {
      return NextResponse.json(
        { error: 'Playlist not found or access denied' },
        { status: 404 }
      );
    }

    // Return synchronization status
    return NextResponse.json({
      success: true,
      playlistId: playlist._id,
      name: playlist.name,
      platforms: {
        spotify: !!playlist.spotifyId,
        youtube: !!playlist.youtubeId
      },
      lastSyncedAt: playlist.lastSyncedAt || null,
      trackCount: playlist.tracks.length
    });
  } catch (error) {
    console.error('Error checking synchronization status:', error);
    return NextResponse.json(
      { 
        error: 'Failed to check synchronization status',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 