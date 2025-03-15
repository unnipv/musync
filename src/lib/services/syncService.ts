import { ITrack, SpotifyTrack, YouTubeTrack, convertSpotifyTrack, convertYouTubeTrack } from '@/types/track';
import { matchTracks } from './trackMatcher';
import * as spotifyService from './spotify';
import * as youtubeService from './youtube';
import Playlist, { IPlaylist } from '@/models/Playlist';
import { Types } from 'mongoose';

/**
 * Interface for synchronization result
 */
interface SyncResult {
  success: boolean;
  error?: string;
  added?: number;
  removed?: number;
  updated?: number;
  details?: {
    addedToSource?: ITrack[];
    addedToTarget?: ITrack[];
    removedFromSource?: ITrack[];
    removedFromTarget?: ITrack[];
    matchedTracks?: Array<{ source: ITrack; target: ITrack; score: number }>;
  };
}

/**
 * Interface for platform-specific API handlers
 */
interface PlatformHandler {
  getPlaylist: (playlistId: string, accessToken: string) => Promise<any>;
  addTracks: (playlistId: string, tracks: ITrack[], accessToken: string) => Promise<any>;
  removeTracks: (playlistId: string, trackIds: string[], accessToken: string) => Promise<any>;
  updatePlaylist: (playlistId: string, details: any, accessToken: string) => Promise<any>;
  convertTrack: (track: any) => ITrack;
}

// Platform-specific handlers
const platformHandlers: Record<string, PlatformHandler> = {
  spotify: {
    getPlaylist: spotifyService.getPlaylist,
    addTracks: spotifyService.addTracksToPlaylist,
    removeTracks: spotifyService.removeTracksFromPlaylist,
    updatePlaylist: spotifyService.updatePlaylistDetails,
    convertTrack: convertSpotifyTrack
  },
  youtube: {
    getPlaylist: youtubeService.getPlaylist,
    addTracks: youtubeService.addTracksToPlaylist,
    removeTracks: youtubeService.removeTracksFromPlaylist,
    updatePlaylist: youtubeService.updatePlaylistDetails,
    convertTrack: convertYouTubeTrack
  }
};

/**
 * Synchronizes a playlist between two platforms
 * 
 * @param playlistId - MongoDB ID of the playlist to synchronize
 * @param sourcePlatform - Source platform ('spotify' or 'youtube')
 * @param targetPlatform - Target platform ('spotify' or 'youtube')
 * @param sourceAccessToken - Access token for source platform
 * @param targetAccessToken - Access token for target platform
 * @param options - Synchronization options
 * @returns Synchronization result
 */
export async function synchronizePlaylist(
  playlistId: string,
  sourcePlatform: 'spotify' | 'youtube',
  targetPlatform: 'spotify' | 'youtube',
  sourceAccessToken: string,
  targetAccessToken: string,
  options = { matchThreshold: 0.8, bidirectional: true }
): Promise<SyncResult> {
  try {
    // Get the playlist from database
    const playlist = await Playlist.findById(playlistId);
    if (!playlist) {
      return { success: false, error: 'Playlist not found' };
    }

    // Get platform-specific handlers
    const sourceHandler = platformHandlers[sourcePlatform];
    const targetHandler = platformHandlers[targetPlatform];
    
    if (!sourceHandler || !targetHandler) {
      return { success: false, error: 'Unsupported platform' };
    }

    // Get platform-specific playlist IDs
    const sourcePlatformId = playlist[`${sourcePlatform}Id`];
    const targetPlatformId = playlist[`${targetPlatform}Id`];
    
    if (!sourcePlatformId || !targetPlatformId) {
      return { 
        success: false, 
        error: `Missing platform ID for ${!sourcePlatformId ? sourcePlatform : targetPlatform}` 
      };
    }

    // Fetch playlists from both platforms
    const sourcePlaylistData = await sourceHandler.getPlaylist(sourcePlatformId, sourceAccessToken);
    const targetPlaylistData = await targetHandler.getPlaylist(targetPlatformId, targetAccessToken);
    
    // Convert tracks to common format
    const sourceTracks = sourcePlaylistData.tracks.map(sourceHandler.convertTrack);
    const targetTracks = targetPlaylistData.tracks.map(targetHandler.convertTrack);
    
    // Match tracks between platforms
    const { matched, unmatchedSource, unmatchedTarget } = matchTracks(
      sourceTracks,
      targetTracks,
      options.matchThreshold
    );
    
    // Tracks to add to target platform (from source)
    const tracksToAddToTarget = options.bidirectional ? unmatchedSource : unmatchedSource;
    
    // Tracks to add to source platform (from target) - only if bidirectional
    const tracksToAddToSource = options.bidirectional ? unmatchedTarget : [];
    
    // Add missing tracks to target platform
    let addedToTargetResult = { success: true, count: 0 };
    if (tracksToAddToTarget.length > 0) {
      addedToTargetResult = await targetHandler.addTracks(
        targetPlatformId,
        tracksToAddToTarget,
        targetAccessToken
      );
    }
    
    // Add missing tracks to source platform (if bidirectional)
    let addedToSourceResult = { success: true, count: 0 };
    if (tracksToAddToSource.length > 0 && options.bidirectional) {
      addedToSourceResult = await sourceHandler.addTracks(
        sourcePlatformId,
        tracksToAddToSource,
        sourceAccessToken
      );
    }
    
    // Update the playlist in the database with the synchronized tracks
    const allTracks = [
      ...matched.map(m => m.source), // Use source tracks for matched
      ...unmatchedSource,
      ...unmatchedTarget
    ];
    
    await Playlist.findByIdAndUpdate(playlistId, {
      $set: {
        tracks: allTracks.map(track => ({
          title: track.title,
          artist: track.artist,
          album: track.album,
          duration: track.duration,
          platformId: track.platformId,
          platform: track.platform,
          uri: track.uri,
          imageUrl: track.imageUrl,
          addedAt: track.addedAt || new Date()
        })),
        lastSyncedAt: new Date()
      }
    });
    
    return {
      success: true,
      added: addedToTargetResult.count + addedToSourceResult.count,
      removed: 0, // Not implementing removal in this version
      updated: matched.length,
      details: {
        addedToTarget: tracksToAddToTarget,
        addedToSource: tracksToAddToSource,
        matchedTracks: matched
      }
    };
  } catch (error) {
    console.error('Synchronization error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown synchronization error'
    };
  }
}

/**
 * Synchronizes a playlist with all connected platforms
 * 
 * @param playlistId - MongoDB ID of the playlist to synchronize
 * @param userAccessTokens - Object containing access tokens for each platform
 * @returns Synchronization results for each platform pair
 */
export async function synchronizeWithAllPlatforms(
  playlistId: string,
  userAccessTokens: Record<string, string>
): Promise<Record<string, SyncResult>> {
  const results: Record<string, SyncResult> = {};
  
  try {
    const playlist = await Playlist.findById(playlistId);
    if (!playlist) {
      return { 'error': { success: false, error: 'Playlist not found' } };
    }
    
    // Get all connected platforms for this playlist
    const connectedPlatforms = Object.keys(platformHandlers).filter(
      platform => playlist[`${platform}Id`]
    );
    
    if (connectedPlatforms.length < 2) {
      return { 
        'error': { 
          success: false, 
          error: 'At least two platforms must be connected for synchronization' 
        } 
      };
    }
    
    // Synchronize between each pair of platforms
    for (let i = 0; i < connectedPlatforms.length; i++) {
      for (let j = i + 1; j < connectedPlatforms.length; j++) {
        const sourcePlatform = connectedPlatforms[i] as 'spotify' | 'youtube';
        const targetPlatform = connectedPlatforms[j] as 'spotify' | 'youtube';
        
        const sourceToken = userAccessTokens[sourcePlatform];
        const targetToken = userAccessTokens[targetPlatform];
        
        if (!sourceToken || !targetToken) {
          results[`${sourcePlatform}-${targetPlatform}`] = {
            success: false,
            error: `Missing access token for ${!sourceToken ? sourcePlatform : targetPlatform}`
          };
          continue;
        }
        
        // Perform bidirectional sync
        const syncResult = await synchronizePlaylist(
          playlistId,
          sourcePlatform,
          targetPlatform,
          sourceToken,
          targetToken,
          { matchThreshold: 0.8, bidirectional: true }
        );
        
        results[`${sourcePlatform}-${targetPlatform}`] = syncResult;
      }
    }
    
    // Update last synced timestamp
    await Playlist.findByIdAndUpdate(playlistId, {
      $set: { lastSyncedAt: new Date() }
    });
    
    return results;
  } catch (error) {
    console.error('Error synchronizing with all platforms:', error);
    return {
      'error': {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown synchronization error'
      }
    };
  }
} 