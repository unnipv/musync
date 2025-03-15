import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import authOptions from '@/lib/auth';
import dbConnect from '@/lib/mongoose';
import Playlist from '@/lib/models/playlist';
import User from '@/lib/models/user';

/**
 * Fetches playlists from Spotify API
 * 
 * @param accessToken - The Spotify access token
 * @returns Array of Spotify playlists
 */
async function fetchSpotifyPlaylists(accessToken: string) {
  const response = await fetch("https://api.spotify.com/v1/me/playlists?limit=50", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    console.error("Spotify API error:", error);
    throw new Error(`Spotify API error: ${error.error?.message || "Unknown error"}`);
  }

  return response.json();
}

/**
 * Fetches tracks for a Spotify playlist
 * 
 * @param accessToken - The Spotify access token
 * @param playlistId - The Spotify playlist ID
 * @returns Array of tracks in the playlist
 */
async function fetchPlaylistTracks(accessToken: string, playlistId: string) {
  const response = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=100`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    console.error("Spotify API error fetching tracks:", error);
    throw new Error(`Spotify API error: ${error.error?.message || "Unknown error"}`);
  }

  return response.json();
}

/**
 * Handles GET requests to import playlists from Spotify
 * 
 * @param request - The incoming request
 * @returns A response containing the imported playlists
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    if (!session.accessToken) {
      return NextResponse.json(
        { error: 'Spotify access token not available. Please reconnect your Spotify account.' },
        { status: 401 }
      );
    }
    
    await dbConnect();
    
    // Get the user to check if they have a Spotify ID
    const user = await User.findById(session.user.id);
    
    if (!user || !user.spotifyId) {
      return NextResponse.json(
        { error: 'Spotify account not connected. Please connect your Spotify account first.' },
        { status: 400 }
      );
    }
    
    // Fetch playlists from Spotify
    const spotifyData = await fetchSpotifyPlaylists(session.accessToken);
    
    if (!spotifyData.items || !Array.isArray(spotifyData.items)) {
      return NextResponse.json(
        { error: 'Failed to fetch playlists from Spotify' },
        { status: 500 }
      );
    }
    
    // Process each playlist
    const importResults = {
      total: spotifyData.items.length,
      imported: 0,
      skipped: 0,
      failed: 0,
    };
    
    for (const spotifyPlaylist of spotifyData.items) {
      try {
        // Skip playlists that the user doesn't own
        if (spotifyPlaylist.owner.id !== user.spotifyId) {
          importResults.skipped++;
          continue;
        }
        
        // Check if playlist already exists
        const existingPlaylist = await Playlist.findOne({
          userId: user._id,
          "platformData.platformId": spotifyPlaylist.id,
          "platformData.platform": "spotify",
        });
        
        if (existingPlaylist) {
          importResults.skipped++;
          continue;
        }
        
        // Fetch tracks for this playlist
        const tracksData = await fetchPlaylistTracks(
          session.accessToken,
          spotifyPlaylist.id
        );
        
        // Map tracks to our format
        const tracks = tracksData.items.map((item: any) => {
          const track = item.track;
          if (!track) return null;
          
          return {
            title: track.name,
            artist: track.artists.map((a: any) => a.name).join(", "),
            album: track.album?.name || "",
            duration: track.duration_ms,
            platform: "spotify",
            platformId: track.id,
            imageUrl: track.album?.images?.[0]?.url || "",
          };
        }).filter(Boolean);
        
        // Create new playlist
        const newPlaylist = new Playlist({
          name: spotifyPlaylist.name,
          description: spotifyPlaylist.description || "",
          userId: user._id,
          tracks: tracks,
          platformData: [
            {
              platform: "spotify",
              platformId: spotifyPlaylist.id,
              lastSyncedAt: new Date(),
            },
          ],
        });
        
        await newPlaylist.save();
        importResults.imported++;
      } catch (error) {
        console.error("Error importing playlist:", error);
        importResults.failed++;
      }
    }
    
    return NextResponse.json({
      message: `Imported ${importResults.imported} playlists (${importResults.skipped} skipped, ${importResults.failed} failed)`,
      results: importResults,
    });
  } catch (error) {
    console.error("Error in Spotify import:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to import playlists" },
      { status: 500 }
    );
  }
}

/**
 * Handles POST requests to import a Spotify playlist
 * @param request - The incoming request object
 * @returns A response containing the imported playlist
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user.id) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    const { spotifyPlaylistId } = await request.json();
    
    if (!spotifyPlaylistId) {
      return NextResponse.json(
        { success: false, message: 'Spotify playlist ID is required' },
        { status: 400 }
      );
    }
    
    await dbConnect();
    
    const spotifyService = new SpotifyService(session.user.id);
    await spotifyService.initialize();
    
    const playlist = await spotifyService.importPlaylist(spotifyPlaylistId);
    
    return NextResponse.json({
      success: true,
      message: 'Playlist imported successfully',
      playlist
    });
  } catch (error) {
    console.error('Error importing Spotify playlist:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: 'Failed to import Spotify playlist', 
        error: (error as Error).message 
      },
      { status: 500 }
    );
  }
} 