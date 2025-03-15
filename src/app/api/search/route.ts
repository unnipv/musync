import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import authOptions from '@/lib/auth';

/**
 * Searches for songs across streaming platforms
 * 
 * @param request - The incoming request with search parameters
 * @returns Search results from specified platforms
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q');
    const platform = searchParams.get('platform') || 'all';
    
    if (!query) {
      return NextResponse.json({ error: 'Search query is required' }, { status: 400 });
    }
    
    let results = [];
    
    // Search Spotify if platform is 'all' or 'spotify'
    if (platform === 'all' || platform === 'spotify') {
      if (session.accessToken) {
        const spotifyResults = await searchSpotify(query, session.accessToken);
        results = [...results, ...spotifyResults];
      }
    }
    
    // Search YouTube if platform is 'all' or 'youtube'
    if (platform === 'all' || platform === 'youtube') {
      // YouTube search implementation would go here
      // For now, we'll just return mock data
      const youtubeResults = await searchYouTube(query);
      results = [...results, ...youtubeResults];
    }
    
    return NextResponse.json({ results });
  } catch (error) {
    console.error('Error searching for songs:', error);
    return NextResponse.json(
      { error: 'Failed to search for songs', details: (error as Error).message },
      { status: 500 }
    );
  }
}

/**
 * Searches for songs on Spotify
 * 
 * @param query - The search query
 * @param accessToken - The Spotify access token
 * @returns Formatted search results from Spotify
 */
async function searchSpotify(query: string, accessToken: string) {
  try {
    const response = await fetch(
      `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=10`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      }
    );
    
    if (!response.ok) {
      throw new Error(`Spotify search failed: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    // Format the results
    return data.tracks.items.map((track: any) => ({
      id: `spotify-${track.id}`,
      title: track.name,
      artist: track.artists.map((artist: any) => artist.name).join(', '),
      album: track.album.name,
      duration: track.duration_ms,
      imageUrl: track.album.images[0]?.url,
      platform: 'spotify',
      platformId: track.id
    }));
  } catch (error) {
    console.error('Error searching Spotify:', error);
    return [];
  }
}

/**
 * Searches for songs on YouTube (mock implementation)
 * 
 * @param query - The search query
 * @returns Mock search results from YouTube
 */
async function searchYouTube(query: string) {
  // This is a mock implementation
  // In a real implementation, you would call the YouTube API
  
  // For now, return some mock data
  return [
    {
      id: `youtube-1`,
      title: `${query} - Official Music Video`,
      artist: 'Various Artists',
      duration: 240000,
      platform: 'youtube',
      platformId: 'dQw4w9WgXcQ'
    },
    {
      id: `youtube-2`,
      title: `${query} - Live Performance`,
      artist: 'Various Artists',
      duration: 300000,
      platform: 'youtube',
      platformId: 'xvFZjo5PgG0'
    }
  ];
} 