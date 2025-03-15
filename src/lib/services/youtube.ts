import { google, youtube_v3 } from 'googleapis';
import User from '../models/user';
import Playlist from '../models/playlist';
import { ObjectId } from 'mongodb';

/**
 * YouTube Music service for interacting with the YouTube Data API
 */
export class YouTubeService {
  private youtube: youtube_v3.Youtube;
  private userId: string;
  private accessToken: string;
  private refreshToken: string;
  private expiresAt: Date;

  /**
   * Creates a new YouTubeService instance
   * @param userId - The MongoDB user ID
   */
  constructor(userId: string) {
    this.userId = userId;
    this.youtube = google.youtube('v3');
    this.accessToken = '';
    this.refreshToken = '';
    this.expiresAt = new Date(0);
  }

  /**
   * Initializes the YouTube API with user credentials
   * @returns A promise that resolves when initialization is complete
   */
  async initialize(): Promise<void> {
    const user = await User.findById(this.userId);
    
    if (!user) {
      throw new Error('User not found');
    }
    
    const youtubeService = user.connectedServices.find(
      (service: any) => service.provider === 'youtube'
    );
    
    if (!youtubeService) {
      throw new Error('YouTube service not connected');
    }
    
    this.accessToken = youtubeService.accessToken;
    this.refreshToken = youtubeService.refreshToken;
    this.expiresAt = new Date(youtubeService.expiresAt);
    
    // Set up OAuth2 client
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.NEXTAUTH_URL + '/api/auth/callback/google'
    );
    
    oauth2Client.setCredentials({
      access_token: this.accessToken,
      refresh_token: this.refreshToken,
      expiry_date: this.expiresAt.getTime()
    });
    
    // Set auth for YouTube API
    this.youtube = google.youtube({
      version: 'v3',
      auth: oauth2Client
    });
    
    // Check if token needs refresh
    if (this.expiresAt.getTime() <= Date.now()) {
      await this.refreshAccessToken(oauth2Client);
    }
  }

  /**
   * Refreshes the YouTube access token
   * @param oauth2Client - The OAuth2 client
   * @returns A promise that resolves when the token is refreshed
   */
  private async refreshAccessToken(oauth2Client: any): Promise<void> {
    try {
      const { credentials } = await oauth2Client.refreshAccessToken();
      
      this.accessToken = credentials.access_token;
      this.expiresAt = new Date(credentials.expiry_date);
      
      // Update user in database
      await User.updateOne(
        { 
          _id: this.userId,
          'connectedServices.provider': 'youtube'
        },
        {
          $set: {
            'connectedServices.$.accessToken': this.accessToken,
            'connectedServices.$.expiresAt': this.expiresAt
          }
        }
      );
    } catch (error) {
      console.error('Error refreshing YouTube token:', error);
      throw new Error('Failed to refresh YouTube token');
    }
  }

  /**
   * Gets the user's YouTube channel
   * @returns The user's YouTube channel
   */
  async getChannel() {
    try {
      const response = await this.youtube.channels.list({
        part: ['snippet', 'contentDetails'],
        mine: true
      });
      
      return response.data.items?.[0];
    } catch (error) {
      console.error('Error getting YouTube channel:', error);
      throw new Error('Failed to get YouTube channel');
    }
  }

  /**
   * Gets the user's YouTube playlists
   * @returns The user's YouTube playlists
   */
  async getPlaylists() {
    try {
      const channel = await this.getChannel();
      
      if (!channel) {
        throw new Error('Channel not found');
      }
      
      const response = await this.youtube.playlists.list({
        part: ['snippet', 'contentDetails'],
        channelId: channel.id,
        maxResults: 50
      });
      
      return response.data.items || [];
    } catch (error) {
      console.error('Error getting YouTube playlists:', error);
      throw new Error('Failed to get YouTube playlists');
    }
  }

  /**
   * Gets a specific YouTube playlist
   * @param playlistId - The YouTube playlist ID
   * @returns The YouTube playlist
   */
  async getPlaylist(playlistId: string) {
    try {
      const response = await this.youtube.playlists.list({
        part: ['snippet', 'contentDetails', 'status'],
        id: [playlistId]
      });
      
      return response.data.items?.[0];
    } catch (error) {
      console.error('Error getting YouTube playlist:', error);
      throw new Error('Failed to get YouTube playlist');
    }
  }

  /**
   * Gets the items in a YouTube playlist
   * @param playlistId - The YouTube playlist ID
   * @returns The playlist items
   */
  async getPlaylistItems(playlistId: string) {
    try {
      const items: any[] = [];
      let nextPageToken: string | undefined = undefined;
      
      do {
        const response: youtube_v3.Schema$PlaylistItemListResponse = await this.youtube.playlistItems.list({
          part: ['snippet', 'contentDetails'],
          playlistId,
          maxResults: 50,
          pageToken: nextPageToken
        });
        
        if (response.data.items) {
          items.push(...response.data.items);
        }
        
        nextPageToken = response.data.nextPageToken || undefined;
      } while (nextPageToken);
      
      return items;
    } catch (error) {
      console.error('Error getting YouTube playlist items:', error);
      throw new Error('Failed to get YouTube playlist items');
    }
  }

  /**
   * Creates a new YouTube playlist
   * @param title - The playlist title
   * @param description - The playlist description
   * @param isPublic - Whether the playlist is public
   * @returns The created YouTube playlist
   */
  async createPlaylist(title: string, description: string, isPublic: boolean) {
    try {
      const response = await this.youtube.playlists.insert({
        part: ['snippet', 'status'],
        requestBody: {
          snippet: {
            title,
            description
          },
          status: {
            privacyStatus: isPublic ? 'public' : 'private'
          }
        }
      });
      
      return response.data;
    } catch (error) {
      console.error('Error creating YouTube playlist:', error);
      throw new Error('Failed to create YouTube playlist');
    }
  }

  /**
   * Adds a video to a YouTube playlist
   * @param playlistId - The YouTube playlist ID
   * @param videoId - The YouTube video ID
   * @returns The result of the operation
   */
  async addVideoToPlaylist(playlistId: string, videoId: string) {
    try {
      const response = await this.youtube.playlistItems.insert({
        part: ['snippet'],
        requestBody: {
          snippet: {
            playlistId,
            resourceId: {
              kind: 'youtube#video',
              videoId
            }
          }
        }
      });
      
      return response.data;
    } catch (error) {
      console.error('Error adding video to YouTube playlist:', error);
      throw new Error('Failed to add video to YouTube playlist');
    }
  }

  /**
   * Removes a video from a YouTube playlist
   * @param playlistItemId - The YouTube playlist item ID
   * @returns The result of the operation
   */
  async removeVideoFromPlaylist(playlistItemId: string) {
    try {
      await this.youtube.playlistItems.delete({
        id: playlistItemId
      });
      
      return { success: true };
    } catch (error) {
      console.error('Error removing video from YouTube playlist:', error);
      throw new Error('Failed to remove video from YouTube playlist');
    }
  }

  /**
   * Searches for videos on YouTube
   * @param query - The search query
   * @returns The search results
   */
  async searchVideos(query: string) {
    try {
      const response = await this.youtube.search.list({
        part: ['snippet'],
        q: query,
        type: ['video'],
        maxResults: 10,
        videoEmbeddable: 'true',
        videoCategoryId: '10' // Music category
      });
      
      return response.data.items || [];
    } catch (error) {
      console.error('Error searching YouTube videos:', error);
      throw new Error('Failed to search YouTube videos');
    }
  }

  /**
   * Gets details for a YouTube video
   * @param videoId - The YouTube video ID
   * @returns The video details
   */
  async getVideoDetails(videoId: string) {
    try {
      const response = await this.youtube.videos.list({
        part: ['snippet', 'contentDetails'],
        id: [videoId]
      });
      
      return response.data.items?.[0];
    } catch (error) {
      console.error('Error getting YouTube video details:', error);
      throw new Error('Failed to get YouTube video details');
    }
  }

  /**
   * Imports a YouTube playlist to Musync
   * @param youtubePlaylistId - The YouTube playlist ID
   * @returns The imported Musync playlist
   */
  async importPlaylist(youtubePlaylistId: string) {
    try {
      // Get playlist details from YouTube
      const youtubePlaylist = await this.getPlaylist(youtubePlaylistId);
      
      if (!youtubePlaylist) {
        throw new Error('YouTube playlist not found');
      }
      
      // Create new Musync playlist
      const playlist = new Playlist({
        name: youtubePlaylist.snippet?.title || 'Untitled Playlist',
        description: youtubePlaylist.snippet?.description || '',
        userId: new ObjectId(this.userId),
        coverImage: youtubePlaylist.snippet?.thumbnails?.high?.url || '',
        isPublic: youtubePlaylist.status?.privacyStatus === 'public',
        tracks: [],
        platformData: [{
          platform: 'youtube',
          platformId: youtubePlaylistId,
          lastSyncedAt: new Date(),
          syncStatus: 'synced'
        }]
      });
      
      // Get all tracks from the playlist
      const playlistItems = await this.getPlaylistItems(youtubePlaylistId);
      
      // Add tracks to the Musync playlist
      for (const item of playlistItems) {
        if (item.snippet && item.contentDetails) {
          // Get more details about the video
          const videoDetails = await this.getVideoDetails(item.contentDetails.videoId);
          
          if (videoDetails && videoDetails.snippet) {
            // Parse title to extract artist and track name
            const title = videoDetails.snippet.title || '';
            let artist = '';
            let trackTitle = title;
            
            // Try to extract artist from title (common format: "Artist - Title")
            const titleParts = title.split(' - ');
            if (titleParts.length > 1) {
              artist = titleParts[0].trim();
              trackTitle = titleParts.slice(1).join(' - ').trim();
            } else {
              // Use channel title as artist if no better option
              artist = videoDetails.snippet.channelTitle || 'Unknown Artist';
            }
            
            // Calculate duration in milliseconds if available
            let duration = 0;
            if (videoDetails.contentDetails && videoDetails.contentDetails.duration) {
              // Parse ISO 8601 duration
              const isoDuration = videoDetails.contentDetails.duration;
              const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
              
              if (match) {
                const hours = parseInt(match[1] || '0', 10);
                const minutes = parseInt(match[2] || '0', 10);
                const seconds = parseInt(match[3] || '0', 10);
                
                duration = (hours * 3600 + minutes * 60 + seconds) * 1000;
              }
            }
            
            playlist.tracks.push({
              title: trackTitle,
              artist,
              album: '',
              duration,
              youtubeId: item.contentDetails.videoId,
              addedAt: new Date(item.snippet.publishedAt || Date.now())
            });
          }
        }
      }
      
      await playlist.save();
      return playlist;
    } catch (error) {
      console.error('Error importing YouTube playlist:', error);
      throw new Error('Failed to import YouTube playlist');
    }
  }

  /**
   * Synchronizes a Musync playlist to YouTube
   * @param playlistId - The Musync playlist ID
   * @returns The result of the synchronization
   */
  async syncPlaylist(playlistId: string) {
    try {
      const playlist = await Playlist.findById(playlistId);
      
      if (!playlist) {
        throw new Error('Playlist not found');
      }
      
      // Check if playlist is already on YouTube
      const youtubeData = playlist.platformData?.find(
        (data) => data.platform === 'youtube'
      );
      
      let youtubePlaylistId: string;
      
      if (youtubeData) {
        // Update existing YouTube playlist
        youtubePlaylistId = youtubeData.id || youtubeData.platformId || '';
        
        // Update playlist details
        await this.youtube.playlists.update({
          part: ['snippet', 'status'],
          requestBody: {
            id: youtubePlaylistId,
            snippet: {
              title: playlist.name || 'My Playlist',
              description: playlist.description || ''
            },
            status: {
              privacyStatus: playlist.isPublic ? 'public' : 'private'
            }
          }
        });
        
        // Get current videos in YouTube playlist
        const playlistItems = await this.getPlaylistItems(youtubePlaylistId);
        
        // Remove all videos
        for (const item of playlistItems) {
          await this.removeVideoFromPlaylist(item.id);
        }
      } else {
        // Create new YouTube playlist
        const newPlaylist = await this.createPlaylist(
          playlist.name || 'My Playlist',
          playlist.description || '',
          playlist.isPublic || false
        );
        
        youtubePlaylistId = newPlaylist.id || '';
        
        // Add platform data to Musync playlist
        if (!playlist.platformData) {
          playlist.platformData = [];
        }
        playlist.platformData.push({
          platform: 'youtube',
          id: youtubePlaylistId,
          lastSyncedAt: new Date(),
          syncStatus: 'synced'
        });
      }
      
      // Add tracks to YouTube playlist
      for (const track of playlist.tracks) {
        let videoId = track.youtubeId;
        
        if (!videoId) {
          // Search for track on YouTube if no youtubeId
          const searchResults = await this.searchVideos(
            `${track.artist} - ${track.title}`
          );
          
          if (searchResults.length > 0 && searchResults[0].id?.videoId) {
            videoId = searchResults[0].id.videoId;
            
            // Update track with YouTube ID
            track.youtubeId = videoId;
          } else {
            // Skip if no match found
            continue;
          }
        }
        
        // Add video to playlist
        if (videoId) {
          await this.addVideoToPlaylist(youtubePlaylistId, videoId);
        }
      }
      
      // Update sync status
      const platformIndex = playlist.platformData?.findIndex(
        (data) => data.platform === 'youtube'
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
      
      return { success: true, playlistId: youtubePlaylistId };
    } catch (error) {
      console.error('Error syncing playlist to YouTube:', error);
      
      // Update sync status to failed
      const playlist = await Playlist.findById(playlistId);
      
      if (playlist) {
        const platformIndex = playlist.platformData?.findIndex(
          (data) => data.platform === 'youtube'
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
      
      throw new Error('Failed to sync playlist to YouTube');
    }
  }
}

export default YouTubeService; 