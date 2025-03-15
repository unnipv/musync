import { Types } from 'mongoose';

/**
 * Interface representing a music track across different platforms
 */
export interface ITrack {
  _id?: Types.ObjectId;
  title: string;
  artist: string;
  album?: string;
  duration?: number;
  platformId?: string;
  platform?: string;
  uri?: string;
  imageUrl?: string;
  addedAt?: Date;
}

/**
 * Interface for track data from Spotify API
 */
export interface SpotifyTrack {
  id: string;
  name: string;
  artists: Array<{ id: string; name: string }>;
  album?: {
    id: string;
    name: string;
    images?: Array<{ url: string; height: number; width: number }>;
  };
  duration_ms?: number;
  uri?: string;
}

/**
 * Interface for track data from YouTube API
 */
export interface YouTubeTrack {
  id: string;
  snippet: {
    title: string;
    channelTitle: string;
    channelId: string;
    publishedAt: string;
    thumbnails?: {
      default?: { url: string; width: number; height: number };
      medium?: { url: string; width: number; height: number };
      high?: { url: string; width: number; height: number };
    };
  };
  contentDetails?: {
    duration?: string; // ISO 8601 duration format
  };
}

/**
 * Converts a Spotify track to the common ITrack format
 * 
 * @param spotifyTrack - Track data from Spotify API
 * @returns Track in common format
 */
export function convertSpotifyTrack(spotifyTrack: SpotifyTrack): ITrack {
  return {
    title: spotifyTrack.name,
    artist: spotifyTrack.artists.map(artist => artist.name).join(', '),
    album: spotifyTrack.album?.name,
    duration: spotifyTrack.duration_ms ? spotifyTrack.duration_ms / 1000 : undefined,
    platformId: spotifyTrack.id,
    platform: 'spotify',
    uri: spotifyTrack.uri,
    imageUrl: spotifyTrack.album?.images?.[0]?.url,
    addedAt: new Date()
  };
}

/**
 * Converts a YouTube track to the common ITrack format
 * 
 * @param youtubeTrack - Track data from YouTube API
 * @returns Track in common format
 */
export function convertYouTubeTrack(youtubeTrack: YouTubeTrack): ITrack {
  // Parse title to extract artist and song title
  // YouTube Music format is typically "Artist - Title" or just "Title"
  let title = youtubeTrack.snippet.title;
  let artist = youtubeTrack.snippet.channelTitle;
  
  const titleParts = youtubeTrack.snippet.title.split(' - ');
  if (titleParts.length > 1) {
    artist = titleParts[0].trim();
    title = titleParts.slice(1).join(' - ').trim();
  }
  
  // Parse ISO 8601 duration if available
  let duration: number | undefined = undefined;
  if (youtubeTrack.contentDetails?.duration) {
    const match = youtubeTrack.contentDetails.duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (match) {
      const hours = parseInt(match[1] || '0');
      const minutes = parseInt(match[2] || '0');
      const seconds = parseInt(match[3] || '0');
      duration = hours * 3600 + minutes * 60 + seconds;
    }
  }
  
  return {
    title,
    artist,
    duration,
    platformId: youtubeTrack.id,
    platform: 'youtube',
    imageUrl: youtubeTrack.snippet.thumbnails?.high?.url || 
              youtubeTrack.snippet.thumbnails?.medium?.url || 
              youtubeTrack.snippet.thumbnails?.default?.url,
    addedAt: new Date(youtubeTrack.snippet.publishedAt)
  };
} 