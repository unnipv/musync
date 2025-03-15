import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

/**
 * Fetches playlists from YouTube Music for the authenticated user
 * 
 * @param req - The incoming request
 * @returns A response with the user's YouTube Music playlists
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    const { db } = await connectToDatabase();
    
    // Check if the user has a YouTube Music connection
    const userPlatform = await db.collection('userPlatforms').findOne({
      userId: new ObjectId(session.user.id),
      platform: 'youtube'
    });
    
    if (!userPlatform) {
      return NextResponse.json(
        { error: 'YouTube Music account not connected', success: false },
        { status: 400 }
      );
    }
    
    // For demonstration purposes, we'll return mock playlists
    // In a real implementation, you would use the YouTube Data API to fetch actual playlists
    const mockPlaylists = [
      {
        id: 'yt-playlist-1',
        name: 'Favorites',
        description: 'My favorite tracks',
        tracks: { total: 25 },
        images: [{ url: 'https://via.placeholder.com/300?text=YouTube+Playlist' }]
      },
      {
        id: 'yt-playlist-2',
        name: 'Workout Mix',
        description: 'Energetic tracks for workouts',
        tracks: { total: 18 },
        images: [{ url: 'https://via.placeholder.com/300?text=YouTube+Playlist' }]
      },
      {
        id: 'yt-playlist-3',
        name: 'Chill Vibes',
        description: 'Relaxing music',
        tracks: { total: 32 },
        images: [{ url: 'https://via.placeholder.com/300?text=YouTube+Playlist' }]
      }
    ];
    
    return NextResponse.json({
      success: true,
      playlists: mockPlaylists
    });
  } catch (error) {
    console.error('Error fetching YouTube Music playlists:', error);
    return NextResponse.json(
      { error: 'Failed to fetch YouTube Music playlists', success: false },
      { status: 500 }
    );
  }
}

/**
 * Imports a playlist from YouTube Music
 * 
 * @param req - The incoming request with YouTube playlist details
 * @returns A response indicating the success of the import
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    const body = await req.json();
    const { youtubePlaylistId } = body;
    
    if (!youtubePlaylistId) {
      return NextResponse.json(
        { error: 'YouTube playlist ID is required' },
        { status: 400 }
      );
    }
    
    const { db } = await connectToDatabase();
    
    // Check if the user has a YouTube Music connection
    const userPlatform = await db.collection('userPlatforms').findOne({
      userId: new ObjectId(session.user.id),
      platform: 'youtube'
    });
    
    if (!userPlatform) {
      return NextResponse.json(
        { error: 'YouTube Music account not connected', success: false },
        { status: 400 }
      );
    }
    
    // For demonstration purposes, we'll create a mock playlist
    // In a real implementation, you would fetch the actual playlist data from YouTube
    const mockPlaylistData = {
      name: 'Imported YouTube Playlist',
      description: 'Playlist imported from YouTube Music',
      tracks: [
        { title: 'Track 1', artist: 'Artist 1', album: 'Album 1', duration: 180 },
        { title: 'Track 2', artist: 'Artist 2', album: 'Album 2', duration: 240 },
        { title: 'Track 3', artist: 'Artist 3', album: 'Album 3', duration: 210 }
      ]
    };
    
    // Create a new playlist in the database
    const result = await db.collection('playlists').insertOne({
      userId: new ObjectId(session.user.id),
      name: mockPlaylistData.name,
      description: mockPlaylistData.description,
      tracks: mockPlaylistData.tracks,
      source: 'youtube',
      sourceId: youtubePlaylistId,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    return NextResponse.json({
      success: true,
      message: 'Successfully imported playlist from YouTube Music',
      playlistId: result.insertedId
    });
  } catch (error) {
    console.error('Error importing YouTube Music playlist:', error);
    return NextResponse.json(
      { error: 'Failed to import YouTube Music playlist', success: false },
      { status: 500 }
    );
  }
} 