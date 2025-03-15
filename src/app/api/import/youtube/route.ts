import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import dbConnect from '@/lib/mongoose';
import { YouTubeService } from '@/lib/services/youtube';
import authOptions from '@/lib/auth';

/**
 * Handles GET requests to fetch user's YouTube playlists
 * @returns A response containing the user's YouTube playlists
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user.id) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    await dbConnect();
    
    const youtubeService = new YouTubeService(session.user.id);
    await youtubeService.initialize();
    
    const playlists = await youtubeService.getPlaylists();
    
    return NextResponse.json({
      success: true,
      playlists
    });
  } catch (error) {
    console.error('Error fetching YouTube playlists:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: 'Failed to fetch YouTube playlists', 
        error: (error as Error).message 
      },
      { status: 500 }
    );
  }
}

/**
 * Handles POST requests to import a YouTube playlist
 * @param request - The incoming request object
 * @returns A response containing the imported playlist
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user.id) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    const { youtubePlaylistId } = await request.json();
    
    if (!youtubePlaylistId) {
      return NextResponse.json(
        { success: false, message: 'YouTube playlist ID is required' },
        { status: 400 }
      );
    }
    
    await dbConnect();
    
    const youtubeService = new YouTubeService(session.user.id);
    await youtubeService.initialize();
    
    const playlist = await youtubeService.importPlaylist(youtubePlaylistId);
    
    return NextResponse.json({
      success: true,
      message: 'Playlist imported successfully',
      playlist
    });
  } catch (error) {
    console.error('Error importing YouTube playlist:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: 'Failed to import YouTube playlist', 
        error: (error as Error).message 
      },
      { status: 500 }
    );
  }
} 