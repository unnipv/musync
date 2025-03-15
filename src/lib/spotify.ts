import { getServerSession } from 'next-auth/next';
import { authOptions } from './auth';

/**
 * Synchronizes a playlist with Spotify
 * 
 * @param playlist - The playlist document to synchronize
 * @returns Object containing sync status and details
 */
export async function syncWithSpotify(playlist: any) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user || !session.user.spotifyAccessToken) {
      return { success: false, error: 'No Spotify access token available' };
    }
    
    const accessToken = session.user.spotifyAccessToken;
    
    // 1. Get the current state of the playlist from Spotify
    const spotifyPlaylist = await fetchSpotifyPlaylist(playlist.spotifyId, accessToken);
    
    // 2. Compare tracks and apply changes in both directions
    const syncResult = await syncTracks(playlist, spotifyPlaylist, accessToken);
    
    return { 
      success: true, 
      added: syncResult.added,
      removed: syncResult.removed,
      updated: syncResult.updated
    };
  } catch (error) {
    console.error('Error syncing with Spotify:', error);
    return { success: false, error: 'Failed to sync with Spotify' };
  }
}

/**
 * Fetches a playlist from Spotify API
 * 
 * @param spotifyId - The Spotify playlist ID
 * @param accessToken - The Spotify access token
 * @returns The playlist data from Spotify
 */
async function fetchSpotifyPlaylist(spotifyId: string, accessToken: string) {
  const response = await fetch(`https://api.spotify.com/v1/playlists/${spotifyId}`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch Spotify playlist: ${response.statusText}`);
  }
  
  return await response.json();
}

/**
 * Synchronizes tracks between local playlist and Spotify
 * 
 * @param localPlaylist - The local playlist document
 * @param spotifyPlaylist - The playlist data from Spotify
 * @param accessToken - The Spotify access token
 * @returns Object containing counts of added, removed, and updated tracks
 */
async function syncTracks(localPlaylist: any, spotifyPlaylist: any, accessToken: string) {
  // Extract track IDs from both sources
  const localTrackIds = new Set(localPlaylist.songs.map((song: any) => song.spotifyId).filter(Boolean));
  const spotifyTrackIds = new Set(spotifyPlaylist.tracks.items.map((item: any) => item.track.id));
  
  // Find tracks to add to Spotify (in local but not in Spotify)
  const tracksToAddToSpotify = [...localTrackIds].filter(id => !spotifyTrackIds.has(id));
  
  // Find tracks to remove from Spotify (not in local but in Spotify)
  const tracksToRemoveFromSpotify = [...spotifyTrackIds].filter(id => !localTrackIds.has(id));
  
  // Apply changes to Spotify
  let added = 0, removed = 0;
  const updated = 0;
  
  if (tracksToAddToSpotify.length > 0) {
    await addTracksToSpotify(spotifyPlaylist.id, tracksToAddToSpotify as string[], accessToken);
    added = tracksToAddToSpotify.length;
  }
  
  if (tracksToRemoveFromSpotify.length > 0) {
    await removeTracksFromSpotify(spotifyPlaylist.id, tracksToRemoveFromSpotify as string[], accessToken);
    removed = tracksToRemoveFromSpotify.length;
  }
  
  // Update local playlist with any new tracks from Spotify
  // This would be implemented based on your data model
  
  return { added, removed, updated };
}

/**
 * Adds tracks to a Spotify playlist
 * 
 * @param playlistId - The Spotify playlist ID
 * @param trackIds - Array of track IDs to add
 * @param accessToken - The Spotify access token
 */
async function addTracksToSpotify(playlistId: string, trackIds: string[], accessToken: string) {
  const uris = trackIds.map(id => `spotify:track:${id}`);
  
  await fetch(`https://api.spotify.com/v1/playlists/${playlistId}/tracks`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ uris })
  });
}

/**
 * Removes tracks from a Spotify playlist
 * 
 * @param playlistId - The Spotify playlist ID
 * @param trackIds - Array of track IDs to remove
 * @param accessToken - The Spotify access token
 */
async function removeTracksFromSpotify(playlistId: string, trackIds: string[], accessToken: string) {
  const tracks = trackIds.map(id => ({ uri: `spotify:track:${id}` }));
  
  await fetch(`https://api.spotify.com/v1/playlists/${playlistId}/tracks`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ tracks })
  });
} 