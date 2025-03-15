export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';

/**
 * Interface for search result items
 */
interface SearchResultItem {
  id: string;
  title: string;
  artist: string;
  album?: string;
  duration?: number;
  platform: string;
  platformId: string;
  uri?: string;
  imageUrl?: string;
}

/**
 * Searches for tracks across connected platforms
 * @param req - The incoming request with search parameters
 * @returns JSON response with search results
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const searchParams = req.nextUrl.searchParams;
    const query = searchParams.get('q');
    const platform = searchParams.get('platform') || 'all';
    
    if (!query) {
      return NextResponse.json({ error: 'Search query is required' }, { status: 400 });
    }
    
    let results: SearchResultItem[] = [];
    
    // Search Spotify if platform is 'all' or 'spotify'
    if (platform === 'all' || platform === 'spotify') {
      if (session.accessToken && session.provider === 'spotify') {
        try {
          const spotifyResults = await searchSpotify(query, session.accessToken);
          results = [...results, ...spotifyResults];
        } catch (error) {
          console.error('Error searching Spotify:', error);
        }
      }
    }
    
    // Search YouTube Music if platform is 'all' or 'youtube'
    if (platform === 'all' || platform === 'youtube') {
      try {
        const youtubeResults = await searchYouTubeMusic(query);
        results = [...results, ...youtubeResults];
      } catch (error) {
        console.error('Error searching YouTube Music:', error);
      }
    }
    
    return NextResponse.json({
      results,
      query,
      platform,
      count: results.length
    });
  } catch (error) {
    console.error('Error in search API:', error);
    return NextResponse.json(
      { error: 'Failed to search tracks', details: String(error) },
      { status: 500 }
    );
  }
}

/**
 * Searches for tracks on Spotify
 * @param query - The search query
 * @param accessToken - Spotify access token
 * @returns Array of search results
 */
async function searchSpotify(query: string, accessToken: string): Promise<SearchResultItem[]> {
  try {
    const response = await fetch(
      `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=20`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      }
    );
    
    if (!response.ok) {
      throw new Error(`Spotify API error: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    return data.tracks.items.map((track: any) => ({
      id: `spotify:${track.id}`,
      title: track.name,
      artist: track.artists.map((artist: any) => artist.name).join(', '),
      album: track.album.name,
      duration: Math.floor(track.duration_ms / 1000),
      platform: 'spotify',
      platformId: track.id,
      uri: track.uri,
      imageUrl: track.album.images[0]?.url
    }));
  } catch (error) {
    console.error('Error searching Spotify:', error);
    return [];
  }
}

/**
 * Searches for tracks on YouTube Music (mock implementation)
 * @param query - The search query
 * @returns Array of search results
 */
async function searchYouTubeMusic(query: string): Promise<SearchResultItem[]> {
  // This is a mock implementation
  // In a real app, you would use the YouTube Music API
  
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Return mock results
  return [
    {
      id: `youtube:mock1`,
      title: `${query} - YouTube Result 1`,
      artist: 'YouTube Artist 1',
      album: 'YouTube Album 1',
      duration: 240,
      platform: 'youtube',
      platformId: 'mock1',
      imageUrl: 'https://via.placeholder.com/300?text=YouTube+Music'
    },
    {
      id: `youtube:mock2`,
      title: `${query} - YouTube Result 2`,
      artist: 'YouTube Artist 2',
      album: 'YouTube Album 2',
      duration: 180,
      platform: 'youtube',
      platformId: 'mock2',
      imageUrl: 'https://via.placeholder.com/300?text=YouTube+Music'
    },
    {
      id: `youtube:mock3`,
      title: `${query} - Live Performance`,
      artist: 'Various Artists',
      duration: 300,
      platform: 'youtube',
      platformId: 'xvFZjo5PgG0',
      imageUrl: 'https://via.placeholder.com/300?text=YouTube+Live'
    }
  ];
} 