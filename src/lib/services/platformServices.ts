import { SpotifyService } from './spotify';
import { YouTubeService } from './youtube';
import { ITrack } from '@/types/track';
import logger from '@/lib/logger';

/**
 * Interface for platform service result
 */
export interface PlatformServiceResult {
  success: boolean;
  error?: string;
  playlistId?: string;
  playlistUrl?: string;
  tracksAdded?: number;
  unavailableTracks?: { title: string; artist: string; album?: string }[];
}

/**
 * Creates a playlist on Spotify and returns its ID and URL
 * 
 * @param service - The authenticated Spotify service
 * @param name - Name of the playlist
 * @param description - Description of the playlist
 * @param isPublic - Whether the playlist should be public
 * @returns Object with success status, playlist ID and URL
 */
export async function createSpotifyPlaylist(
  service: SpotifyService,
  name: string,
  description: string,
  isPublic: boolean
): Promise<PlatformServiceResult> {
  try {
    const playlist = await service.createPlaylist(name, description, isPublic);
    
    if (!playlist || !playlist.id) {
      return {
        success: false,
        error: 'Failed to create Spotify playlist'
      };
    }
    
    return {
      success: true,
      playlistId: playlist.id,
      playlistUrl: `https://open.spotify.com/playlist/${playlist.id}`
    };
  } catch (error) {
    logger.error('Error creating Spotify playlist:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error creating Spotify playlist'
    };
  }
}

/**
 * Creates a playlist on YouTube and returns its ID and URL
 * 
 * @param service - The authenticated YouTube service
 * @param name - Name of the playlist
 * @param description - Description of the playlist
 * @param isPublic - Whether the playlist should be public
 * @returns Object with success status, playlist ID and URL
 */
export async function createYouTubePlaylist(
  service: YouTubeService,
  name: string,
  description: string,
  isPublic: boolean
): Promise<PlatformServiceResult> {
  try {
    const playlist = await service.createPlaylist(name, description, isPublic);
    
    if (!playlist || !playlist.id) {
      return {
        success: false,
        error: 'Failed to create YouTube playlist'
      };
    }
    
    return {
      success: true,
      playlistId: playlist.id,
      playlistUrl: `https://www.youtube.com/playlist?list=${playlist.id}`
    };
  } catch (error) {
    logger.error('Error creating YouTube playlist:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error creating YouTube playlist'
    };
  }
}

/**
 * Add tracks to a Spotify playlist
 * 
 * @param service - Spotify service instance
 * @param playlistId - ID of the Spotify playlist
 * @param tracks - Tracks to add to the playlist
 * @returns Result of the operation
 */
export async function addTracksToSpotify(
  service: SpotifyService,
  playlistId: string,
  tracks: ITrack[]
): Promise<PlatformServiceResult> {
  try {
    // Filter tracks to get those with Spotify IDs
    const trackIds = tracks
      .filter(track => track.platform === 'spotify' && track.platformId)
      .map(track => track.platformId as string);
    
    if (trackIds.length === 0) {
      // Try to search for tracks by name and artist
      const tracksWithIds = [];
      
      for (const track of tracks) {
        const searchQuery = `${track.title} artist:${track.artist}`;
        logger.debug(`Searching for track on Spotify: "${searchQuery}"`);
        
        const searchResult = await service.searchTracks(searchQuery);
        
        if (searchResult) {
          logger.debug(`Found match on Spotify for: "${searchQuery}" - ID: ${searchResult.id}`);
          tracksWithIds.push(searchResult.id);
        } else {
          logger.debug(`No match found on Spotify for: "${searchQuery}"`);
        }
      }
      
      // If we found any tracks, add them
      if (tracksWithIds.length > 0) {
        const result = await service.addTracksToPlaylist(playlistId, tracksWithIds);
        return {
          success: true,
          tracksAdded: tracksWithIds.length
        };
      }
      
      return {
        success: true,
        tracksAdded: 0
      };
    }
    
    logger.debug(`Adding ${trackIds.length} tracks to Spotify playlist: ${playlistId}`);
    
    const result = await service.addTracksToPlaylist(playlistId, trackIds);
    
    if (trackIds.length > 0) {
      return {
        success: true,
        tracksAdded: trackIds.length
      };
    } else {
      logger.debug('No tracks to add to Spotify playlist');
      return {
        success: true,
        tracksAdded: 0
      };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Add tracks to a YouTube playlist
 * 
 * @param service - YouTube service instance
 * @param playlistId - ID of the YouTube playlist
 * @param tracks - Tracks to add to the playlist
 * @returns Result of the operation
 */
export async function addTracksToYouTube(
  service: YouTubeService,
  playlistId: string,
  tracks: ITrack[]
): Promise<PlatformServiceResult> {
  try {
    // Filter tracks to get those with YouTube IDs
    const trackIds = tracks
      .filter(track => track.platform === 'youtube' && track.platformId)
      .map(track => track.platformId as string);
    
    if (trackIds.length === 0) {
      // Try to search for tracks by name and artist
      const tracksWithIds = [];
      
      for (const track of tracks) {
        const searchQuery = `${track.artist} - ${track.title}`;
        logger.debug(`Searching for track on YouTube: "${searchQuery}"`);
        
        const searchResult = await service.searchVideos(searchQuery);
        
        if (searchResult) {
          logger.debug(`Found match on YouTube for: "${searchQuery}" - ID: ${searchResult.id}`);
          tracksWithIds.push(searchResult.id);
        } else {
          logger.debug(`No match found on YouTube for: "${searchQuery}"`);
        }
      }
      
      // If we found any tracks, add them
      if (tracksWithIds.length > 0) {
        const result = await service.addTracksToPlaylist(playlistId, tracksWithIds);
        return {
          success: true,
          tracksAdded: tracksWithIds.length
        };
      }
      
      return {
        success: true,
        tracksAdded: 0
      };
    }
    
    logger.debug(`Adding ${trackIds.length} tracks to YouTube playlist: ${playlistId}`);
    
    const result = await service.addTracksToPlaylist(playlistId, trackIds);
    
    if (trackIds.length > 0) {
      return {
        success: true,
        tracksAdded: trackIds.length
      };
    } else {
      logger.debug('No tracks to add to YouTube playlist');
      return {
        success: true,
        tracksAdded: 0
      };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
} 