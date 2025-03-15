import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import authOptions from '@/lib/auth';
import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

/**
 * Fetches playlists from Spotify for the authenticated user
 * 
 * @param req - The incoming request
 * @returns A response with the user's Spotify playlists
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    console.log('Session in Spotify import:', { 
      userId: session?.user?.id, 
      hasAccessToken: !!session?.accessToken 
    });
    
    if (!session || !session.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized', success: false },
        { status: 401 }
      );
    }
    
    if (!session.accessToken) {
      return NextResponse.json(
        { error: 'No Spotify access token available', success: false },
        { status: 400 }
      );
    }
    
    const { db } = await connectToDatabase();
    
    // Check if the user has a Spotify connection
    const userPlatform = await db.collection('userPlatforms').findOne({
      userId: new ObjectId(session.user.id),
      platform: 'spotify'
    });
    
    if (!userPlatform) {
      return NextResponse.json(
        { error: 'Spotify account not connected', success: false },
        { status: 400 }
      );
    }
    
    // Fetch playlists from Spotify API
    try {
      const spotifyResponse = await fetch('https://api.spotify.com/v1/me/playlists?limit=50', {
        headers: {
          Authorization: `Bearer ${session.accessToken}`
        }
      });
      
      if (!spotifyResponse.ok) {
        const errorData = await spotifyResponse.json();
        console.error('Spotify API error:', errorData);
        
        if (spotifyResponse.status === 401) {
          return NextResponse.json(
            { error: 'Spotify access token expired. Please reconnect your account.', success: false },
            { status: 401 }
          );
        }
        
        throw new Error(`Spotify API error: ${errorData.error?.message || 'Unknown error'}`);
      }
      
      const spotifyData = await spotifyResponse.json();
      
      return NextResponse.json({
        success: true,
        playlists: spotifyData.items || []
      });
    } catch (error) {
      console.error('Error fetching Spotify playlists:', error);
      return NextResponse.json(
        { error: 'Failed to fetch Spotify playlists. Please try again.', success: false },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error in Spotify import API:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred', success: false },
      { status: 500 }
    );
  }
}

/**
 * Imports a playlist from Spotify
 * 
 * @param req - The incoming request with Spotify playlist details
 * @returns A response indicating the success of the import
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized', success: false },
        { status: 401 }
      );
    }
    
    if (!session.accessToken) {
      return NextResponse.json(
        { error: 'No Spotify access token available', success: false },
        { status: 400 }
      );
    }
    
    const body = await req.json();
    const { spotifyPlaylistId } = body;
    
    if (!spotifyPlaylistId) {
      return NextResponse.json(
        { error: 'Spotify playlist ID is required', success: false },
        { status: 400 }
      );
    }
    
    const { db } = await connectToDatabase();
    
    // Check if the user has a Spotify connection
    const userPlatform = await db.collection('userPlatforms').findOne({
      userId: new ObjectId(session.user.id),
      platform: 'spotify'
    });
    
    if (!userPlatform) {
      return NextResponse.json(
        { error: 'Spotify account not connected', success: false },
        { status: 400 }
      );
    }
    
    // Fetch playlist details from Spotify
    try {
      // Get playlist details
      const playlistResponse = await fetch(`https://api.spotify.com/v1/playlists/${spotifyPlaylistId}`, {
        headers: {
          Authorization: `Bearer ${session.accessToken}`
        }
      });
      
      if (!playlistResponse.ok) {
        const errorData = await playlistResponse.json();
        throw new Error(`Spotify API error: ${errorData.error?.message || 'Unknown error'}`);
      }
      
      const playlistData = await playlistResponse.json();
      
      // Get playlist tracks
      const tracksResponse = await fetch(`https://api.spotify.com/v1/playlists/${spotifyPlaylistId}/tracks`, {
        headers: {
          Authorization: `Bearer ${session.accessToken}`
        }
      });
      
      if (!tracksResponse.ok) {
        const errorData = await tracksResponse.json();
        throw new Error(`Spotify API error: ${errorData.error?.message || 'Unknown error'}`);
      }
      
      const tracksData = await tracksResponse.json();
      
      // Format tracks for our database
      const tracks = tracksData.items.map((item: any) => {
        const track = item.track;
        return {
          title: track.name,
          artist: track.artists.map((artist: any) => artist.name).join(', '),
          album: track.album.name,
          duration: Math.floor(track.duration_ms / 1000),
          spotifyId: track.id,
          spotifyUri: track.uri
        };
      });
      
      // Create a new playlist in our database
      const result = await db.collection('playlists').insertOne({
        userId: new ObjectId(session.user.id),
        name: playlistData.name,
        description: playlistData.description || '',
        tracks,
        source: 'spotify',
        sourceId: spotifyPlaylistId,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      
      return NextResponse.json({
        success: true,
        message: 'Successfully imported playlist from Spotify',
        playlistId: result.insertedId
      });
    } catch (error) {
      console.error('Error importing Spotify playlist:', error);
      return NextResponse.json(
        { error: 'Failed to import Spotify playlist. Please try again.', success: false },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error in Spotify import API:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred', success: false },
      { status: 500 }
    );
  }
} 