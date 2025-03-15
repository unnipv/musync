import { getServerSession } from 'next-auth/next';
import { authOptions } from './auth';

/**
 * Synchronizes a playlist with YouTube Music
 * 
 * @param playlist - The playlist document to synchronize
 * @returns Object containing sync status and details
 */
export async function syncWithYouTube(playlist: any) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user || !session.user.googleAccessToken) {
      return { success: false, error: 'No Google access token available' };
    }
    
    const accessToken = session.user.googleAccessToken;
    
    // 1. Get the current state of the playlist from YouTube Music
    const youtubePlaylist = await fetchYouTubePlaylist(playlist.youtubeId, accessToken);
    
    // 2. Compare tracks and apply changes in both directions
    const syncResult = await syncTracks(playlist, youtubePlaylist, accessToken);
    
    return { 
      success: true, 
      added: syncResult.added,
      removed: syncResult.removed,
      updated: syncResult.updated
    };
  } catch (error) {
    console.error('Error syncing with YouTube Music:', error);
    return { success: false, error: 'Failed to sync with YouTube Music' };
  }
}

/**
 * Fetches a playlist from YouTube Music API
 * 
 * @param youtubeId - The YouTube playlist ID
 * @param accessToken - The Google access token
 * @returns The playlist data from YouTube
 */
async function fetchYouTubePlaylist(youtubeId: string, accessToken: string) {
  const response = await fetch(
    `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=50&playlistId=${youtubeId}`, 
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    }
  );
  
  if (!response.ok) {
    throw new Error(`Failed to fetch YouTube playlist: ${response.statusText}`);
  }
  
  return await response.json();
}

/**
 * Synchronizes tracks between local playlist and YouTube Music
 * 
 * @param localPlaylist - The local playlist document
 * @param youtubePlaylist - The playlist data from YouTube
 * @param accessToken - The Google access token
 * @returns Object containing counts of added, removed, and updated tracks
 */
async function syncTracks(localPlaylist: any, youtubePlaylist: any, accessToken: string) {
  // Extract video IDs from both sources
  const localVideoIds = new Set(localPlaylist.songs.map((song: any) => song.youtubeId).filter(Boolean));
  const youtubeVideoIds = new Set(youtubePlaylist.items.map((item: any) => item.snippet.resourceId.videoId));
  
  // Find videos to add to YouTube (in local but not in YouTube)
  const videosToAddToYouTube = [...localVideoIds].filter(id => !youtubeVideoIds.has(id));
  
  // Find videos to remove from YouTube (not in local but in YouTube)
  const videosToRemoveFromYouTube = [...youtubeVideoIds].filter(id => !localVideoIds.has(id));
  
  // Apply changes to YouTube
  let added = 0, removed = 0;
  const updated = 0;
  
  if (videosToAddToYouTube.length > 0) {
    for (const videoId of videosToAddToYouTube) {
      await addVideoToYouTubePlaylist(localPlaylist.youtubeId, videoId as string, accessToken);
    }
    added = videosToAddToYouTube.length;
  }
  
  if (videosToRemoveFromYouTube.length > 0) {
    // First, get the playlistItem IDs for the videos we want to remove
    const playlistItems = youtubePlaylist.items.filter((item: any) => 
      videosToRemoveFromYouTube.includes(item.snippet.resourceId.videoId)
    );
    
    for (const item of playlistItems) {
      await removeVideoFromYouTubePlaylist(item.id, accessToken);
    }
    
    removed = playlistItems.length;
  }
  
  // Update local playlist with any new tracks from YouTube
  // This would be implemented based on your data model
  
  return { added, removed, updated };
}

/**
 * Adds a video to a YouTube playlist
 * 
 * @param playlistId - The YouTube playlist ID
 * @param videoId - The video ID to add
 * @param accessToken - The Google access token
 */
async function addVideoToYouTubePlaylist(playlistId: string, videoId: string, accessToken: string) {
  await fetch('https://www.googleapis.com/youtube/v3/playlistItems?part=snippet', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      snippet: {
        playlistId: playlistId,
        resourceId: {
          kind: 'youtube#video',
          videoId: videoId
        }
      }
    })
  });
}

/**
 * Removes a video from a YouTube playlist
 * 
 * @param playlistItemId - The YouTube playlist item ID
 * @param accessToken - The Google access token
 */
async function removeVideoFromYouTubePlaylist(playlistItemId: string, accessToken: string) {
  await fetch(`https://www.googleapis.com/youtube/v3/playlistItems?id=${playlistItemId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  });
} 