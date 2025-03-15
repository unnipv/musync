import { synchronizePlaylist, synchronizeWithAllPlatforms } from '../syncService';
import { matchTracks } from '../trackMatcher';
import * as spotifyService from '../spotify';
import * as youtubeService from '../youtube';
import Playlist from '@/models/Playlist';
import { ITrack } from '@/types/track';
import mongoose from 'mongoose';

// Mock dependencies
jest.mock('../trackMatcher');
jest.mock('../spotify');
jest.mock('../youtube');
jest.mock('@/models/Playlist');

describe('Synchronization Service', () => {
  // Setup test data
  const mockPlaylistId = new mongoose.Types.ObjectId().toString();
  const mockSpotifyId = 'spotify-playlist-123';
  const mockYoutubeId = 'youtube-playlist-456';
  const mockSpotifyAccessToken = 'spotify-token';
  const mockYoutubeAccessToken = 'youtube-token';
  
  const mockPlaylist = {
    _id: mockPlaylistId,
    spotifyId: mockSpotifyId,
    youtubeId: mockYoutubeId,
    name: 'Test Playlist',
    tracks: []
  };
  
  const mockSpotifyTracks: ITrack[] = [
    {
      title: 'Track 1',
      artist: 'Artist 1',
      platform: 'spotify',
      platformId: 'spotify-track-1'
    },
    {
      title: 'Track 2',
      artist: 'Artist 2',
      platform: 'spotify',
      platformId: 'spotify-track-2'
    }
  ];
  
  const mockYoutubeTracks: ITrack[] = [
    {
      title: 'Track 1',
      artist: 'Artist 1',
      platform: 'youtube',
      platformId: 'youtube-track-1'
    },
    {
      title: 'Track 3',
      artist: 'Artist 3',
      platform: 'youtube',
      platformId: 'youtube-track-3'
    }
  ];
  
  const mockMatchResult = {
    matched: [
      {
        source: mockSpotifyTracks[0],
        target: mockYoutubeTracks[0],
        score: 1.0
      }
    ],
    unmatchedSource: [mockSpotifyTracks[1]],
    unmatchedTarget: [mockYoutubeTracks[1]]
  };
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup mocks
    (Playlist.findById as jest.Mock).mockResolvedValue(mockPlaylist);
    (Playlist.findByIdAndUpdate as jest.Mock).mockResolvedValue(mockPlaylist);
    
    (spotifyService.getPlaylist as jest.Mock).mockResolvedValue({
      id: mockSpotifyId,
      name: 'Test Playlist on Spotify',
      tracks: mockSpotifyTracks
    });
    
    (youtubeService.getPlaylist as jest.Mock).mockResolvedValue({
      id: mockYoutubeId,
      name: 'Test Playlist on YouTube',
      tracks: mockYoutubeTracks
    });
    
    (spotifyService.addTracksToPlaylist as jest.Mock).mockResolvedValue({
      success: true,
      count: 1
    });
    
    (youtubeService.addTracksToPlaylist as jest.Mock).mockResolvedValue({
      success: true,
      count: 1
    });
    
    (matchTracks as jest.Mock).mockReturnValue(mockMatchResult);
  });
  
  describe('synchronizePlaylist', () => {
    it('should synchronize tracks between Spotify and YouTube', async () => {
      const result = await synchronizePlaylist(
        mockPlaylistId,
        'spotify',
        'youtube',
        mockSpotifyAccessToken,
        mockYoutubeAccessToken
      );
      
      // Verify the result
      expect(result.success).toBe(true);
      expect(result.added).toBe(2); // 1 from Spotify to YouTube, 1 from YouTube to Spotify
      expect(result.updated).toBe(1); // 1 matched track
      
      // Verify that the playlist was fetched from both platforms
      expect(spotifyService.getPlaylist).toHaveBeenCalledWith(
        mockSpotifyId,
        mockSpotifyAccessToken
      );
      
      expect(youtubeService.getPlaylist).toHaveBeenCalledWith(
        mockYoutubeId,
        mockYoutubeAccessToken
      );
      
      // Verify that tracks were matched
      expect(matchTracks).toHaveBeenCalledWith(
        mockSpotifyTracks,
        mockYoutubeTracks,
        0.8
      );
      
      // Verify that unmatched tracks were added to both platforms
      expect(youtubeService.addTracksToPlaylist).toHaveBeenCalledWith(
        mockYoutubeId,
        [mockSpotifyTracks[1]],
        mockYoutubeAccessToken
      );
      
      expect(spotifyService.addTracksToPlaylist).toHaveBeenCalledWith(
        mockSpotifyId,
        [mockYoutubeTracks[1]],
        mockSpotifyAccessToken
      );
      
      // Verify that the playlist was updated in the database
      expect(Playlist.findByIdAndUpdate).toHaveBeenCalled();
    });
    
    it('should handle errors gracefully', async () => {
      // Setup error scenario
      (spotifyService.getPlaylist as jest.Mock).mockRejectedValue(
        new Error('API error')
      );
      
      const result = await synchronizePlaylist(
        mockPlaylistId,
        'spotify',
        'youtube',
        mockSpotifyAccessToken,
        mockYoutubeAccessToken
      );
      
      // Verify the result
      expect(result.success).toBe(false);
      expect(result.error).toBe('API error');
    });
  });
  
  describe('synchronizeWithAllPlatforms', () => {
    it('should synchronize a playlist with all connected platforms', async () => {
      const userAccessTokens = {
        spotify: mockSpotifyAccessToken,
        youtube: mockYoutubeAccessToken
      };
      
      const result = await synchronizeWithAllPlatforms(
        mockPlaylistId,
        userAccessTokens
      );
      
      // Verify the result
      expect(result['spotify-youtube']).toBeDefined();
      expect(result['spotify-youtube'].success).toBe(true);
      
      // Verify that the playlist was updated in the database
      expect(Playlist.findByIdAndUpdate).toHaveBeenCalled();
    });
    
    it('should handle missing access tokens', async () => {
      const userAccessTokens = {
        spotify: mockSpotifyAccessToken
        // YouTube token missing
      };
      
      const result = await synchronizeWithAllPlatforms(
        mockPlaylistId,
        userAccessTokens
      );
      
      // Verify the result
      expect(result['spotify-youtube']).toBeDefined();
      expect(result['spotify-youtube'].success).toBe(false);
      expect(result['spotify-youtube'].error).toContain('Missing access token');
    });
  });
}); 