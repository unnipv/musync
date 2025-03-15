import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/mongodb';
import Playlist from '@/models/Playlist';
import { synchronizeWithAllPlatforms } from '@/lib/services/syncService';

/**
 * Handles POST requests to synchronize a playlist between platforms
 * 
 * @param req - The incoming request
 * @returns API response with synchronization results
 */
export async function POST(req: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Connect to database
    await connectToDatabase();

    // Parse request body
    const body = await req.json();
    const { playlistId } = body;

    if (!playlistId) {
      return NextResponse.json(
        { error: 'Playlist ID is required' },
        { status: 400 }
      );
    }

    // Check if playlist exists and belongs to the user
    const playlist = await Playlist.findOne({
      _id: playlistId,
      userId: session.user.id
    });

    if (!playlist) {
      return NextResponse.json(
        { error: 'Playlist not found or access denied' },
        { status: 404 }
      );
    }

    // Check if playlist has platform IDs
    const hasPlatformIds = playlist.spotifyId || playlist.youtubeId;
    if (!hasPlatformIds) {
      return NextResponse.json(
        { error: 'Playlist is not connected to any platforms' },
        { status: 400 }
      );
    }

    // Get access tokens from session
    const userAccessTokens: Record<string, string> = {};
    
    if (session.user.spotifyAccessToken) {
      userAccessTokens.spotify = session.user.spotifyAccessToken;
    }
    
    if (session.user.googleAccessToken) {
      userAccessTokens.youtube = session.user.googleAccessToken;
    }

    // Perform synchronization
    const syncResults = await synchronizeWithAllPlatforms(
      playlistId,
      userAccessTokens
    );

    // Check if synchronization was successful
    const hasErrors = Object.values(syncResults).some(result => !result.success);
    
    if (hasErrors) {
      // Return partial success with error details
      return NextResponse.json(
        { 
          success: false, 
          message: 'Synchronization completed with errors',
          results: syncResults
        },
        { status: 207 } // Multi-Status
      );
    }

    // Return success response
    return NextResponse.json({
      success: true,
      message: 'Playlist synchronized successfully',
      results: syncResults
    });
  } catch (error) {
    console.error('Error synchronizing playlist:', error);
    return NextResponse.json(
      { 
        error: 'Failed to synchronize playlist',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * Handles GET requests to check synchronization status
 * 
 * @param req - The incoming request
 * @returns API response with synchronization status
 */
export async function GET(req: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Connect to database
    await connectToDatabase();

    // Get playlist ID from URL
    const url = new URL(req.url);
    const playlistId = url.searchParams.get('playlistId');

    if (!playlistId) {
      return NextResponse.json(
        { error: 'Playlist ID is required' },
        { status: 400 }
      );
    }

    // Check if playlist exists and belongs to the user
    const playlist = await Playlist.findOne({
      _id: playlistId,
      userId: session.user.id
    });

    if (!playlist) {
      return NextResponse.json(
        { error: 'Playlist not found or access denied' },
        { status: 404 }
      );
    }

    // Return synchronization status
    return NextResponse.json({
      success: true,
      playlistId: playlist._id,
      name: playlist.name,
      platforms: {
        spotify: !!playlist.spotifyId,
        youtube: !!playlist.youtubeId
      },
      lastSyncedAt: playlist.lastSyncedAt || null,
      trackCount: playlist.tracks.length
    });
  } catch (error) {
    console.error('Error checking synchronization status:', error);
    return NextResponse.json(
      { 
        error: 'Failed to check synchronization status',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 