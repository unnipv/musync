import { ITrack, SpotifyTrack, YouTubeTrack, convertSpotifyTrack, convertYouTubeTrack } from '@/types/track';
import { matchTracks } from './trackMatcher';
import * as spotifyService from './spotify';
import * as youtubeService from './youtube';
import Playlist, { PlatformData as PlaylistPlatformData } from '@/models/Playlist';
import { Types } from 'mongoose';
import { Document } from 'mongoose';
import { ObjectId } from 'mongodb';
import { YouTubeService } from './youtube';
import { SpotifyService } from './spotify';
import { PlatformData } from '@/models/Playlist';
import { connectToDatabase } from '@/lib/mongodb';

/**
 * Interface for synchronization result
 */
interface SyncResult {
  success: boolean;
  error?: string;
  added?: number;
  removed?: number;
  updated?: number;
  unavailableTracks?: any[];
  playlistUrl?: string;
  details?: {
    addedToSource?: ITrack[];
    addedToTarget?: ITrack[];
    removedFromSource?: ITrack[];
    removedFromTarget?: ITrack[];
    matchedTracks?: Array<{ source: ITrack; target: ITrack; score: number }>;
  };
}

interface PlatformIds {
  [key: string]: string | undefined;
}

interface Track {
  platformId: string;
  title: string;
  artist: string;
}

interface PlatformHandler {
  service: YouTubeService | SpotifyService;
  getPlaylist: (playlistId: string) => Promise<any>;
  addTracks: (playlistId: string, trackIds: string[]) => Promise<any>;
  removeTracks: (playlistId: string, trackIds: string[]) => Promise<any>;
  updatePlaylist: (playlistId: string, title: string, description: string, isPublic: boolean) => Promise<any>;
  convertTrack: (track: any) => Track;
}

interface PlaylistType {
  _id: Types.ObjectId;
  platformData?: PlatformData[];
  lastSyncedAt?: Date;
  [key: string]: any; // For dynamic properties like spotifyId, youtubeId
}

// Platform-specific handlers
const platformHandlers: Record<string, PlatformHandler> = {
  youtube: {
    service: new YouTubeService(''),
    getPlaylist: async (playlistId: string) => {
      const service = new YouTubeService('');
      return service.getPlaylist(playlistId);
    },
    addTracks: async (playlistId: string, trackIds: string[]) => {
      const service = new YouTubeService('');
      return service.addTracksToPlaylist(playlistId, trackIds);
    },
    removeTracks: async (playlistId: string, trackIds: string[]) => {
      const service = new YouTubeService('');
      return service.removeTracksFromPlaylist(playlistId, trackIds);
    },
    updatePlaylist: async (playlistId: string, title: string, description: string, isPublic: boolean) => {
      const service = new YouTubeService('');
      return service.updatePlaylistDetails(playlistId, title, description, isPublic);
    },
    convertTrack: (track: any): Track => ({
      platformId: track.id,
      title: track.title,
      artist: track.artist
    })
  },
  spotify: {
    service: new SpotifyService(''),
    getPlaylist: async (playlistId: string) => {
      const service = new SpotifyService('');
      return service.getPlaylist(playlistId);
    },
    addTracks: async (playlistId: string, trackIds: string[]) => {
      const service = new SpotifyService('');
      return service.addTracksToPlaylist(playlistId, trackIds);
    },
    removeTracks: async (playlistId: string, trackIds: string[]) => {
      const service = new SpotifyService('');
      return service.removeTracksFromPlaylist(playlistId, trackIds);
    },
    updatePlaylist: async (playlistId: string, title: string, description: string, isPublic: boolean) => {
      const service = new SpotifyService('');
      await service.initialize();
      return service.syncPlaylist(playlistId);
    },
    convertTrack: (track: any): Track => ({
      platformId: track.id,
      title: track.title,
      artist: track.artist
    })
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

    // Get platform-specific playlist IDs from platform data
    let sourcePlatformId: string | undefined;
    let targetPlatformId: string | undefined;
    
    // Find platform IDs in platformData array
    if (playlist.platformData && Array.isArray(playlist.platformData)) {
      // Find source platform ID
      const sourceData = playlist.platformData.find(data => data.platform === sourcePlatform);
      if (sourceData) sourcePlatformId = sourceData.id;
      
      // Find target platform ID
      const targetData = playlist.platformData.find(data => data.platform === targetPlatform);
      if (targetData) targetPlatformId = targetData.id;
    }
    
    if (!sourcePlatformId || !targetPlatformId) {
      return { 
        success: false, 
        error: `Missing platform ID for ${!sourcePlatformId ? sourcePlatform : targetPlatform}` 
      };
    }

    // Fetch playlists from both platforms
    const sourcePlaylistData = await sourceHandler.getPlaylist(sourcePlatformId);
    const targetPlaylistData = await targetHandler.getPlaylist(targetPlatformId);
    
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
      // Filter out undefined platformIds and ensure all values are strings
      const trackIds = tracksToAddToTarget
        .map(track => track.platformId)
        .filter((id): id is string => typeof id === 'string');
        
      addedToTargetResult = await targetHandler.addTracks(
        targetPlatformId,
        trackIds
      );
    }
    
    // Add missing tracks to source platform (if bidirectional)
    let addedToSourceResult = { success: true, count: 0 };
    if (tracksToAddToSource.length > 0 && options.bidirectional) {
      // Filter out undefined platformIds and ensure all values are strings
      const trackIds = tracksToAddToSource
        .map(track => track.platformId)
        .filter((id): id is string => typeof id === 'string');
        
      addedToSourceResult = await sourceHandler.addTracks(
        sourcePlatformId,
        trackIds
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
    const connectedPlatforms: string[] = [];
    
    // Find all platforms that have an ID in the platformData array
    if (playlist.platformData && Array.isArray(playlist.platformData)) {
      playlist.platformData.forEach(data => {
        if (data.platform && platformHandlers[data.platform]) {
          connectedPlatforms.push(data.platform);
        }
      });
    }
    
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

/**
 * Synchronizes a playlist with all connected platforms
 * 
 * @param playlist - The playlist to synchronize
 * @returns The result of the synchronization
 */
export async function syncPlaylist(playlist: PlaylistType) {
  try {
    // Get platform IDs from the playlist
    const platformIds = (playlist.platformData || []).reduce<PlatformIds>((acc, data: PlatformData) => {
      acc[data.platform] = data.id;
      return acc;
    }, {});

    // Filter out undefined IDs and convert to string array
    const validTrackIds = Object.values(platformIds).filter((id): id is string => typeof id === 'string');

    // Use the filtered track IDs array
    if (validTrackIds.length > 0) {
      const youtubeHandler = platformHandlers.youtube;
      const spotifyHandler = platformHandlers.spotify;

      // Add tracks to each platform
      await Promise.all([
        youtubeHandler.addTracks(playlist._id.toString(), validTrackIds),
        spotifyHandler.addTracks(playlist._id.toString(), validTrackIds)
      ]);
    }

    // Update the playlist in the database
    const { db } = await connectToDatabase();
    await db.collection('playlists').updateOne(
      { _id: playlist._id },
      { $set: { lastSyncedAt: new Date() } }
    );

    return { success: true };
  } catch (error) {
    console.error('Error syncing playlist:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Synchronizes a playlist with a specific platform
 * 
 * @param playlistId - MongoDB ID of the playlist to synchronize
 * @param targetPlatform - Target platform ('spotify' or 'youtube')
 * @param accessToken - Access token for the target platform
 * @returns Synchronization result for the specified platform
 */
export async function synchronizeWithPlatform(
  playlistId: string,
  targetPlatform: 'spotify' | 'youtube',
  accessToken: string
): Promise<SyncResult> {
  try {
    // Connect to database
    await connectToDatabase();
    
    // Get the playlist from database
    const playlist = await Playlist.findById(playlistId);
    if (!playlist) {
      return { success: false, error: 'Playlist not found' };
    }
    
    // Verify that the playlist has tracks
    if (!playlist.tracks || playlist.tracks.length === 0) {
      return { success: false, error: 'Playlist has no tracks to sync' };
    }
    
    // Set platform handler
    const targetHandler = platformHandlers[targetPlatform];
    
    if (!targetHandler) {
      return { success: false, error: 'Unsupported platform' };
    }
    
    // Initialize the handler with the access token
    if (targetPlatform === 'spotify') {
      targetHandler.service = new SpotifyService(accessToken);
    } else {
      targetHandler.service = new YouTubeService(accessToken);
    }
    
    // Get platform-specific playlist ID
    let targetPlatformId: string | undefined;
    
    // Find platform IDs in platformData array
    if (playlist.platformData && Array.isArray(playlist.platformData)) {
      const targetData = playlist.platformData.find(data => data.platform === targetPlatform);
      if (targetData) targetPlatformId = targetData.id;
    }
    
    // Fallback to legacy fields if platformData doesn't exist
    if (!targetPlatformId) {
      targetPlatformId = targetPlatform === 'spotify' ? playlist.spotifyId : playlist.youtubeId;
    }
    
    // If no playlist ID is found for the target platform, create a new one
    if (!targetPlatformId) {
      try {
        console.log(`Creating new ${targetPlatform} playlist for: ${playlist.name}`);
        let newPlaylist;
        
        if (targetPlatform === 'spotify') {
          const spotifyService = targetHandler.service as SpotifyService;
          newPlaylist = await spotifyService.createPlaylist(
            playlist.name,
            playlist.description || `Playlist synchronized from Musync`,
            playlist.isPublic
          );
        } else {
          const youtubeService = targetHandler.service as YouTubeService;
          newPlaylist = await youtubeService.createPlaylist(
            playlist.name,
            playlist.description || `Playlist synchronized from Musync`,
            playlist.isPublic
          );
        }
        
        if (!newPlaylist || !newPlaylist.id) {
          return {
            success: false,
            error: `Failed to create ${targetPlatform} playlist`
          };
        }
        
        targetPlatformId = newPlaylist.id;
        
        // Update the playlist in the database with the new platform ID
        const updateObj: any = {};
        
        // Update in platformData array if it exists
        if (playlist.platformData && Array.isArray(playlist.platformData)) {
          const platformData = [...playlist.platformData];
          
          // Ensure targetPlatformId is a string
          if (targetPlatformId) {
            platformData.push({
              platform: targetPlatform,
              id: targetPlatformId,
              lastSyncedAt: new Date()
            });
            updateObj.platformData = platformData;
          }
        } else {
          // Update legacy field
          if (targetPlatformId) {
            updateObj[`${targetPlatform}Id`] = targetPlatformId;
          }
        }
        
        await Playlist.findByIdAndUpdate(playlistId, { $set: updateObj });
        
        console.log(`Created new ${targetPlatform} playlist with ID: ${targetPlatformId}`);
      } catch (error) {
        console.error(`Error creating ${targetPlatform} playlist:`, error);
        return {
          success: false,
          error: `Failed to create ${targetPlatform} playlist: ${error instanceof Error ? error.message : 'Unknown error'}`
        };
      }
    }
    
    // Fetch playlist from target platform
    if (!targetPlatformId) {
      return {
        success: false,
        error: `Target platform ID for ${targetPlatform} is undefined or empty.`
      };
    }
    
    const targetPlaylistData = await targetHandler.getPlaylist(targetPlatformId);
    
    // Convert tracks to common format
    const musyncTracks = playlist.tracks.map((track: any) => ({
      platformId: track.platformId,
      title: track.title,
      artist: track.artist,
      album: track.album,
      duration: track.duration,
      platform: track.platform,
      uri: track.uri,
      imageUrl: track.imageUrl,
      addedAt: track.addedAt || new Date()
    }));
    
    const targetTracks = targetPlaylistData.tracks.map(targetHandler.convertTrack);
    
    // Match tracks between platforms
    const { matched, unmatchedSource, unmatchedTarget } = matchTracks(
      musyncTracks,
      targetTracks,
      0.8  // Match threshold
    );
    
    // Tracks to add to target platform (from source)
    const tracksToAddToTarget = unmatchedSource;
    
    // Add missing tracks to target platform
    let addedToTargetResult = { success: true, count: 0 };
    const unavailableTracks: any[] = [];
    
    if (tracksToAddToTarget.length > 0) {
      try {
        // First, attempt to find the tracks on the target platform
        const trackSearchPromises = tracksToAddToTarget.map(async (track) => {
          try {
            // Improve search query by removing special characters and combining title and artist
            const searchQuery = `${track.title} ${track.artist}`.replace(/[^\w\s]/gi, ' ').trim();
            console.log(`Searching for track on ${targetPlatform}: "${searchQuery}"`);
            
            let searchResult;
            
            if (targetPlatform === 'spotify') {
              const spotifyService = targetHandler.service as SpotifyService;
              // Use non-null assertion to satisfy TypeScript
              searchResult = await spotifyService.searchTracks(searchQuery);
            } else {
              const youtubeService = targetHandler.service as YouTubeService;
              // Use non-null assertion to satisfy TypeScript
              searchResult = await youtubeService.searchVideos(searchQuery);
            }
            
            if (searchResult && searchResult.id) {
              console.log(`Found match on ${targetPlatform} for: "${searchQuery}" - ID: ${searchResult.id}`);
              return { original: track, found: searchResult };
            } else {
              console.log(`No match found on ${targetPlatform} for: "${searchQuery}"`);
              unavailableTracks.push({
                title: track.title,
                artist: track.artist,
                album: track.album
              });
              return { original: track, found: null };
            }
          } catch (error) {
            console.error(`Failed to search for track: ${track.title} - ${track.artist}`, error);
            unavailableTracks.push({
              title: track.title,
              artist: track.artist,
              album: track.album
            });
            return { original: track, found: null };
          }
        });
        
        const searchResults = await Promise.all(trackSearchPromises);
        const tracksToAdd = searchResults
          .filter(result => result.found !== null)
          .map(result => result.found!.id); // Non-null assertion to satisfy TypeScript
        
        if (tracksToAdd.length > 0) {
          console.log(`Adding ${tracksToAdd.length} tracks to ${targetPlatform} playlist: ${targetPlatformId}`);
          addedToTargetResult = await targetHandler.addTracks(
            targetPlatformId!,  // Non-null assertion to satisfy TypeScript
            tracksToAdd
          );
          console.log(`Added ${addedToTargetResult.count} tracks to ${targetPlatform} playlist`);
        } else {
          console.log(`No tracks to add to ${targetPlatform} playlist`);
        }
      } catch (error) {
        console.error('Error adding tracks to target platform:', error);
        return { 
          success: false, 
          error: `Failed to add tracks to ${targetPlatform}`, 
          unavailableTracks 
        };
      }
    }
    
    // Update the playlist's lastSyncedAt timestamp
    await Playlist.findByIdAndUpdate(playlistId, {
      $set: {
        lastSyncedAt: new Date()
      }
    });
    
    // Update the platformData's lastSyncedAt and syncStatus
    if (playlist.platformData && Array.isArray(playlist.platformData)) {
      const platformDataIndex = playlist.platformData.findIndex(
        data => data.platform === targetPlatform
      );
      
      if (platformDataIndex !== -1) {
        const updatePath = `platformData.${platformDataIndex}`;
        await Playlist.findByIdAndUpdate(playlistId, {
          $set: {
            [`${updatePath}.lastSyncedAt`]: new Date(),
            [`${updatePath}.syncStatus`]: 'success'
          }
        });
      }
    }
    
    // Get the playlist URL for the response
    let playlistUrl: string;
    if (targetPlatform === 'spotify' && targetPlatformId) {
      playlistUrl = `https://open.spotify.com/playlist/${targetPlatformId}`;
    } else if (targetPlatformId) {
      playlistUrl = `https://www.youtube.com/playlist?list=${targetPlatformId}`;
    } else {
      playlistUrl = ''; // Fallback empty string
    }
    
    return {
      success: true,
      added: addedToTargetResult.count,
      updated: matched.length,
      unavailableTracks,
      playlistUrl
    };
  } catch (error) {
    console.error('Error in synchronizeWithPlatform:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error during synchronization' 
    };
  }
} 