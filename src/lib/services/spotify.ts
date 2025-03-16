import SpotifyWebApi from 'spotify-web-api-node';
import User from '../models/user';
import Playlist from '../models/playlist';
import { ObjectId } from 'mongodb';
import { ITrack } from '@/types/track';

// Define interfaces for Spotify API response types
interface SpotifyArtist {
  id: string;
  name: string;
  uri: string;
}

interface SpotifyAlbum {
  id: string;
  name: string;
  images?: Array<{ url: string; height: number; width: number }>;
}

interface SpotifyTrack {
  id: string;
  name: string;
  artists: SpotifyArtist[];
  album?: SpotifyAlbum;
  duration_ms?: number;
  uri?: string;
}

// Define interfaces for Spotify API response objects
interface TrackObjectFull {
  id: string;
  name: string;
  artists: Array<{ id: string; name: string; uri?: string }>;
  album: {
    id: string;
    name: string;
    images?: Array<{ url: string; height: number; width: number }>;
  };
  duration_ms?: number;
  uri?: string;
}

interface ArtistObjectSimplified {
  id: string;
  name: string;
  uri?: string;
}

interface PlaylistObjectFull {
  id: string;
  name: string;
  description?: string;
  public?: boolean;
  tracks: {
    items: Array<{
      track: TrackObjectFull;
      added_at?: string;
    }>;
    total: number;
  };
}

interface AlbumObjectSimplified {
  id: string;
  name: string;
  images?: Array<{ url: string; height: number; width: number }>;
}

/**
 * Spotify service for interacting with the Spotify API
 */
export class SpotifyService {
  private spotifyApi: SpotifyWebApi;
  private userId: string;
  private accessToken: string;
  private refreshToken: string;
  private expiresAt: Date;

  /**
   * Creates a new SpotifyService instance
   * @param userId - The MongoDB user ID
   */
  constructor(userId: string) {
    this.userId = userId;
    this.spotifyApi = new SpotifyWebApi({
      clientId: process.env.SPOTIFY_CLIENT_ID,
      clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
      redirectUri: process.env.NEXTAUTH_URL + '/api/auth/callback/spotify'
    });
    this.accessToken = '';
    this.refreshToken = '';
    this.expiresAt = new Date(0);
  }

  /**
   * Initializes the Spotify API with user credentials
   * @returns A promise that resolves when initialization is complete
   */
  async initialize(): Promise<void> {
    const user = await User.findById(this.userId);
    
    if (!user) {
      throw new Error('User not found');
    }
    
    const spotifyService = user.connectedServices.find(
      (service: any) => service.provider === 'spotify'
    );
    
    if (!spotifyService) {
      throw new Error('Spotify service not connected');
    }
    
    this.accessToken = spotifyService.accessToken;
    this.refreshToken = spotifyService.refreshToken;
    this.expiresAt = new Date(spotifyService.expiresAt);
    
    this.spotifyApi.setAccessToken(this.accessToken);
    this.spotifyApi.setRefreshToken(this.refreshToken);
    
    // Check if token needs refresh
    if (this.expiresAt.getTime() <= Date.now()) {
      await this.refreshAccessToken();
    }
  }

  /**
   * Refreshes the Spotify access token
   * @returns A promise that resolves when the token is refreshed
   */
  private async refreshAccessToken(): Promise<void> {
    try {
      const data = await this.spotifyApi.refreshAccessToken();
      
      this.accessToken = data.body.access_token;
      this.spotifyApi.setAccessToken(this.accessToken);
      
      // Update expiration time (subtract 5 minutes for safety)
      const expiresIn = data.body.expires_in;
      this.expiresAt = new Date(Date.now() + (expiresIn - 300) * 1000);
      
      // Update user in database
      await User.updateOne(
        { 
          _id: this.userId,
          'connectedServices.provider': 'spotify'
        },
        {
          $set: {
            'connectedServices.$.accessToken': this.accessToken,
            'connectedServices.$.expiresAt': this.expiresAt
          }
        }
      );
    } catch (error) {
      console.error('Error refreshing Spotify token:', error);
      throw new Error('Failed to refresh Spotify token');
    }
  }

  /**
   * Gets the user's Spotify profile
   * @returns The user's Spotify profile
   */
  async getProfile() {
    try {
      const response = await this.spotifyApi.getMe();
      return response.body;
    } catch (error) {
      console.error('Error getting Spotify profile:', error);
      throw new Error('Failed to get Spotify profile');
    }
  }

  /**
   * Gets the user's Spotify playlists
   * @returns The user's Spotify playlists
   */
  async getPlaylists() {
    try {
      const response = await this.spotifyApi.getUserPlaylists();
      return response.body.items;
    } catch (error) {
      console.error('Error getting Spotify playlists:', error);
      throw new Error('Failed to get Spotify playlists');
    }
  }

  /**
   * Gets a specific Spotify playlist
   * @param playlistId - The Spotify playlist ID
   * @returns The Spotify playlist
   */
  async getPlaylist(playlistId: string) {
    try {
      const response = await this.spotifyApi.getPlaylist(playlistId);
      return response.body;
    } catch (error) {
      console.error('Error getting Spotify playlist:', error);
      throw new Error('Failed to get Spotify playlist');
    }
  }

  /**
   * Creates a new Spotify playlist
   * @param name - The playlist name
   * @param description - The playlist description
   * @param isPublic - Whether the playlist is public
   * @returns The created Spotify playlist
   */
  async createPlaylist(name: string, description: string, isPublic: boolean) {
    try {
      const profile = await this.getProfile();
      const response = await this.spotifyApi.createPlaylist(profile.id, {
        name,
        description,
        public: isPublic
      });
      return response.body;
    } catch (error) {
      console.error('Error creating Spotify playlist:', error);
      throw new Error('Failed to create Spotify playlist');
    }
  }

  /**
   * Adds tracks to a Spotify playlist
   * @param playlistId - The Spotify playlist ID
   * @param trackUris - The Spotify track URIs
   * @returns The result of the operation
   */
  async addTracksToPlaylist(playlistId: string, trackUris: string[]) {
    try {
      const response = await this.spotifyApi.addTracksToPlaylist(playlistId, trackUris);
      return response.body;
    } catch (error) {
      console.error('Error adding tracks to Spotify playlist:', error);
      throw new Error('Failed to add tracks to Spotify playlist');
    }
  }

  /**
   * Removes tracks from a Spotify playlist
   * @param playlistId - The Spotify playlist ID
   * @param trackUris - The Spotify track URIs
   * @returns The result of the operation
   */
  async removeTracksFromPlaylist(playlistId: string, trackUris: string[]) {
    try {
      const response = await this.spotifyApi.removeTracksFromPlaylist(
        playlistId,
        trackUris.map(uri => ({ uri }))
      );
      return response.body;
    } catch (error) {
      console.error('Error removing tracks from Spotify playlist:', error);
      throw new Error('Failed to remove tracks from Spotify playlist');
    }
  }

  /**
   * Searches for tracks on Spotify
   * @param query - The search query
   * @returns The search results
   */
  async searchTracks(query: string) {
    try {
      const response = await this.spotifyApi.searchTracks(query);
      const searchResults = await response;
      
      if (!searchResults.body.tracks) {
        return [];
      }
      
      return searchResults.body.tracks.items.map((track: any) => ({
        id: track.id,
        name: track.name,
        artists: track.artists.map((artist: any) => ({
          id: artist.id,
          name: artist.name,
          uri: artist.uri
        })),
        album: track.album ? {
          id: track.album.id,
          name: track.album.name
        } : undefined,
        duration_ms: track.duration_ms,
        uri: track.uri
      }));
    } catch (error) {
      console.error('Error searching Spotify tracks:', error);
      throw new Error('Failed to search Spotify tracks');
    }
  }

  /**
   * Imports a Spotify playlist to Musync
   * @param spotifyPlaylistId - The Spotify playlist ID
   * @returns The imported Musync playlist
   */
  async importPlaylist(spotifyPlaylistId: string) {
    try {
      // Get playlist details from Spotify
      const spotifyPlaylist = await this.getPlaylist(spotifyPlaylistId);
      
      // Create new Musync playlist
      const playlist = new Playlist({
        name: spotifyPlaylist.name,
        description: spotifyPlaylist.description || '',
        userId: new ObjectId(this.userId),
        coverImage: spotifyPlaylist.images[0]?.url || '',
        isPublic: spotifyPlaylist.public,
        tracks: [],
        platformData: [{
          platform: 'spotify',
          platformId: spotifyPlaylistId,
          lastSyncedAt: new Date(),
          syncStatus: 'synced'
        }]
      });
      
      // Get all tracks from the playlist (handling pagination)
      let tracks = spotifyPlaylist.tracks.items;
      let offset = 100;
      
      while (tracks.length < spotifyPlaylist.tracks.total) {
        const moreTracksResponse = await this.spotifyApi.getPlaylistTracks(spotifyPlaylistId, {
          offset,
          limit: 100
        });
        
        tracks = [...tracks, ...moreTracksResponse.body.items];
        offset += 100;
      }
      
      // Add tracks to the Musync playlist
      for (const item of tracks) {
        const track = item.track;
        
        if (track) {
          playlist.tracks.push({
            title: track.name,
            artist: track.artists.map((a: { name: string }) => a.name).join(', '),
            album: track.album.name,
            duration: track.duration_ms,
            spotifyId: track.id,
            addedAt: new Date(item.added_at)
          });
        }
      }
      
      await playlist.save();
      return playlist;
    } catch (error) {
      console.error('Error importing Spotify playlist:', error);
      throw new Error('Failed to import Spotify playlist');
    }
  }

  /**
   * Synchronizes a Musync playlist to Spotify
   * @param playlistId - The Musync playlist ID
   * @returns The result of the synchronization
   */
  async syncPlaylist(playlistId: string) {
    try {
      const playlist = await Playlist.findById(playlistId);
      
      if (!playlist) {
        throw new Error('Playlist not found');
      }
      
      // Check if playlist is already on Spotify
      const spotifyData = playlist.platformData?.find(
        (data) => data.platform === 'spotify'
      );
      
      let spotifyPlaylistId: string;
      
      if (spotifyData) {
        // Update existing Spotify playlist
        spotifyPlaylistId = spotifyData.id || spotifyData.platformId || '';
        
        // Update playlist details
        await this.spotifyApi.changePlaylistDetails(spotifyPlaylistId, {
          name: playlist.name || 'My Playlist',
          description: playlist.description || '',
          public: playlist.isPublic || false
        });
        
        // Get current tracks in Spotify playlist
        const spotifyPlaylist = await this.getPlaylist(spotifyPlaylistId);
        const spotifyTrackUris = spotifyPlaylist.tracks.items.map(
          (item: any) => item.track.uri
        );
        
        // Remove all tracks
        if (spotifyTrackUris.length > 0) {
          await this.removeTracksFromPlaylist(spotifyPlaylistId, spotifyTrackUris);
        }
      } else {
        // Create new Spotify playlist
        const newPlaylist = await this.createPlaylist(
          playlist.name || 'My Playlist',
          playlist.description || '',
          playlist.isPublic || false
        );
        
        spotifyPlaylistId = newPlaylist.id;
        
        // Add platform data to Musync playlist
        if (!playlist.platformData) {
          playlist.platformData = [];
        }
        playlist.platformData.push({
          platform: 'spotify',
          id: spotifyPlaylistId,
          lastSyncedAt: new Date(),
          syncStatus: 'synced'
        });
      }
      
      // Add tracks to Spotify playlist
      const trackUris: string[] = [];
      
      for (const track of playlist.tracks) {
        if (track.spotifyId) {
          trackUris.push(`spotify:track:${track.spotifyId}`);
        } else {
          // Search for track on Spotify if no spotifyId
          const searchResults = await this.searchTracks(
            `${track.title} ${track.artist}`
          );
          
          if (searchResults.length > 0) {
            const spotifyTrack = searchResults[0];
            trackUris.push(spotifyTrack.uri);
            
            // Update track with Spotify ID
            track.spotifyId = spotifyTrack.id;
          }
        }
      }
      
      // Add tracks in batches of 100 (Spotify API limit)
      for (let i = 0; i < trackUris.length; i += 100) {
        const batch = trackUris.slice(i, i + 100);
        if (batch.length > 0) {
          await this.addTracksToPlaylist(spotifyPlaylistId, batch);
        }
      }
      
      // Update sync status
      const platformIndex = playlist.platformData?.findIndex(
        (data) => data.platform === 'spotify'
      );
      
      if (platformIndex !== undefined && platformIndex >= 0 && playlist.platformData) {
        if (!playlist.platformData[platformIndex].syncStatus) {
          // Add syncStatus property if it doesn't exist
          const updatedPlatformData = {
            ...playlist.platformData[platformIndex],
            syncStatus: 'synced',
            lastSyncedAt: new Date()
          };
          
          playlist.platformData[platformIndex] = updatedPlatformData;
        } else {
          playlist.platformData[platformIndex].syncStatus = 'synced';
          playlist.platformData[platformIndex].lastSyncedAt = new Date();
        }
      }
      
      await playlist.save();
      
      return { success: true, playlistId: spotifyPlaylistId };
    } catch (error) {
      console.error('Error syncing playlist to Spotify:', error);
      
      // Update sync status to failed
      const playlist = await Playlist.findById(playlistId);
      
      if (playlist) {
        const platformIndex = playlist.platformData?.findIndex(
          (data) => data.platform === 'spotify'
        );
        
        if (platformIndex !== undefined && platformIndex >= 0 && playlist.platformData) {
          if (!playlist.platformData[platformIndex].syncStatus) {
            // Add syncStatus property if it doesn't exist
            const updatedPlatformData = {
              ...playlist.platformData[platformIndex],
              syncStatus: 'failed',
              syncError: (error as Error).message
            };
            
            playlist.platformData[platformIndex] = updatedPlatformData;
          } else {
            playlist.platformData[platformIndex].syncStatus = 'failed';
            playlist.platformData[platformIndex].syncError = (error as Error).message;
          }
          
          await playlist.save();
        }
      }
      
      throw new Error('Failed to sync playlist to Spotify');
    }
  }
}

export default SpotifyService;

/**
 * Creates a Spotify API client with the provided access token
 * 
 * @param accessToken - OAuth access token for Spotify API
 * @returns Configured Spotify API client
 */
function createSpotifyClient(accessToken: string): SpotifyWebApi {
  const spotifyApi = new SpotifyWebApi();
  spotifyApi.setAccessToken(accessToken);
  return spotifyApi;
}

/**
 * Fetches a playlist from Spotify
 * 
 * @param playlistId - Spotify playlist ID
 * @param accessToken - OAuth access token
 * @returns Playlist data with tracks
 */
export async function getPlaylist(playlistId: string, accessToken: string) {
  try {
    const spotify = createSpotifyClient(accessToken);
    
    // Get playlist details
    const playlistResponse = await spotify.getPlaylist(playlistId);
    const playlistData = playlistResponse.body;
    
    // Get all tracks (handle pagination)
    const tracks: SpotifyTrack[] = [];
    let offset = 0;
    const limit = 100;
    const total = playlistData.tracks.total;
    
    while (offset < total) {
      const tracksResponse = await spotify.getPlaylistTracks(playlistId, {
        offset,
        limit,
        fields: 'items(track(id,name,artists,album,duration_ms,uri))'
      });
      
      const trackItems = tracksResponse.body.items;
      
      for (const item of trackItems) {
        if (item.track) {
          tracks.push({
            id: item.track.id,
            name: item.track.name,
            artists: item.track.artists.map((artist: ArtistObjectSimplified) => ({
              id: artist.id,
              name: artist.name,
              uri: artist.uri
            })),
            album: item.track.album ? {
              id: item.track.album.id,
              name: item.track.album.name,
              images: item.track.album.images
            } : undefined,
            duration_ms: item.track.duration_ms,
            uri: item.track.uri
          });
        }
      }
      
      offset += limit;
    }
    
    return {
      id: playlistData.id,
      name: playlistData.name,
      description: playlistData.description,
      tracks
    };
  } catch (error) {
    console.error('Error fetching Spotify playlist:', error);
    throw new Error('Failed to fetch Spotify playlist');
  }
}

/**
 * Adds tracks to a Spotify playlist
 * 
 * @param playlistId - Spotify playlist ID
 * @param tracks - Tracks to add
 * @param accessToken - OAuth access token
 * @returns Result of the operation
 */
export async function addTracksToPlaylist(
  playlistId: string,
  tracks: ITrack[],
  accessToken: string
): Promise<{ success: boolean; count: number }> {
  try {
    const spotify = createSpotifyClient(accessToken);
    let addedCount = 0;
    
    // For tracks without Spotify URIs, search for them first
    const tracksToAdd: string[] = [];
    
    for (const track of tracks) {
      try {
        if (track.uri && track.platform === 'spotify') {
          // Track already has a Spotify URI
          tracksToAdd.push(track.uri);
          addedCount++;
        } else {
          // Search for the track on Spotify
          const searchQuery = `track:${track.title} artist:${track.artist}`;
          const searchResponse = spotify.searchTracks(searchQuery);
          const searchResults = await searchResponse;
          
          if (searchResults.body.tracks && searchResults.body.tracks.items.length > 0) {
            const spotifyTrack = searchResults.body.tracks.items[0];
            tracksToAdd.push(spotifyTrack.uri);
            addedCount++;
          }
        }
      } catch (trackError) {
        console.error(`Error processing track "${track.title}" for Spotify playlist:`, trackError);
        // Continue with next track
      }
    }
    
    // Add tracks in batches of 100 (Spotify API limit)
    const batchSize = 100;
    for (let i = 0; i < tracksToAdd.length; i += batchSize) {
      const batch = tracksToAdd.slice(i, i + batchSize);
      await spotify.addTracksToPlaylist(playlistId, batch);
    }
    
    return { success: true, count: addedCount };
  } catch (error) {
    console.error('Error adding tracks to Spotify playlist:', error);
    return { success: false, count: 0 };
  }
}

/**
 * Removes tracks from a Spotify playlist
 * 
 * @param playlistId - Spotify playlist ID
 * @param trackUris - URIs of tracks to remove
 * @param accessToken - OAuth access token
 * @returns Result of the operation
 */
export async function removeTracksFromPlaylist(
  playlistId: string,
  trackUris: string[],
  accessToken: string
): Promise<{ success: boolean; count: number }> {
  try {
    const spotify = createSpotifyClient(accessToken);
    
    // Remove tracks in batches of 100 (Spotify API limit)
    const batchSize = 100;
    let removedCount = 0;
    
    for (let i = 0; i < trackUris.length; i += batchSize) {
      const batch = trackUris.slice(i, i + batchSize);
      const tracksToRemove = batch.map(uri => ({ uri }));
      
      await spotify.removeTracksFromPlaylist(playlistId, tracksToRemove);
      removedCount += batch.length;
    }
    
    return { success: true, count: removedCount };
  } catch (error) {
    console.error('Error removing tracks from Spotify playlist:', error);
    return { success: false, count: 0 };
  }
}

/**
 * Updates Spotify playlist details
 * 
 * @param playlistId - Spotify playlist ID
 * @param details - New playlist details
 * @param accessToken - OAuth access token
 * @returns Updated playlist data
 */
export async function updatePlaylistDetails(
  playlistId: string,
  details: { name?: string; description?: string; isPublic?: boolean },
  accessToken: string
): Promise<{ success: boolean }> {
  try {
    const spotify = createSpotifyClient(accessToken);
    
    await spotify.changePlaylistDetails(playlistId, {
      name: details.name,
      description: details.description,
      public: details.isPublic
    });
    
    return { success: true };
  } catch (error) {
    console.error('Error updating Spotify playlist details:', error);
    return { success: false };
  }
}

/**
 * Creates a new playlist on Spotify
 * 
 * @param name - Playlist name
 * @param description - Playlist description
 * @param isPublic - Whether the playlist is public
 * @param accessToken - OAuth access token
 * @returns Created playlist ID
 */
export async function createPlaylist(
  name: string,
  description: string,
  isPublic: boolean,
  accessToken: string
): Promise<{ id: string; success: boolean }> {
  try {
    const spotify = createSpotifyClient(accessToken);
    
    // Get user ID (required for creating playlists)
    const meResponse = await spotify.getMe();
    const userId = meResponse.body.id;
    
    const response = await spotify.createPlaylist(userId, {
      name,
      description,
      public: isPublic
    });
    
    const playlist = await response;
    
    return { id: playlist.id, success: true };
  } catch (error) {
    console.error('Error creating Spotify playlist:', error);
    return { id: '', success: false };
  }
}

/**
 * Searches for tracks on Spotify
 * 
 * @param query - Search query
 * @param accessToken - OAuth access token
 * @param limit - Maximum number of results to return
 * @returns Search results
 */
export async function searchTracksWithToken(
  query: string,
  accessToken: string,
  limit = 10
): Promise<ITrack[]> {
  try {
    const spotify = createSpotifyClient(accessToken);
    
    const searchResponse = await spotify.searchTracks(query);
    const searchResults = await searchResponse;
    
    if (!searchResults.body.tracks) {
      return [];
    }
    
    return searchResults.body.tracks.items.map((track: any) => ({
      id: track.id,
      name: track.name,
      artists: track.artists.map((artist: any) => ({
        id: artist.id,
        name: artist.name,
        uri: artist.uri
      })),
      album: track.album ? {
        id: track.album.id,
        name: track.album.name,
        images: track.album.images
      } : undefined,
      duration_ms: track.duration_ms,
      uri: track.uri
    }));
  } catch (error) {
    console.error('Error searching Spotify tracks:', error);
    return [];
  }
}

function convertArtist(artist: any): SpotifyArtist {
  return {
    id: artist.id,
    name: artist.name,
    uri: artist.uri
  };
} 