import SpotifyWebApi from 'spotify-web-api-node';
import User from '../models/user';
import Playlist from '../models/playlist';
import { ObjectId } from 'mongodb';

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
      return response.body.tracks?.items || [];
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