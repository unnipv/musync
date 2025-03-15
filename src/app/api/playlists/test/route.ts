export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import dbConnect from '@/lib/mongoose';
import Playlist from '@/lib/models/playlist';
import { authOptions } from '@/lib/auth';

/**
 * Test API route that returns a summary of the user's playlists
 * This helps verify that the playlist API is working correctly
 * 
 * @returns A response containing playlist statistics
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
    
    // Get playlist statistics
    const totalPlaylists = await Playlist.countDocuments({ userId: session.user.id });
    const spotifyPlaylists = await Playlist.countDocuments({ 
      userId: session.user.id,
      'platformData.provider': 'spotify'
    });
    const youtubePlaylists = await Playlist.countDocuments({ 
      userId: session.user.id,
      'platformData.provider': 'youtube'
    });
    const syncedPlaylists = await Playlist.countDocuments({
      userId: session.user.id,
      platformData: { $size: 2 }
    });
    
    // Get the most recent playlist
    const recentPlaylist = await Playlist.findOne({ userId: session.user.id })
      .sort({ updatedAt: -1 })
      .select('name updatedAt');
    
    return NextResponse.json({
      success: true,
      stats: {
        totalPlaylists,
        spotifyPlaylists,
        youtubePlaylists,
        syncedPlaylists,
        recentPlaylist: recentPlaylist ? {
          id: recentPlaylist._id,
          name: recentPlaylist.name,
          updatedAt: recentPlaylist.updatedAt
        } : null
      }
    });
  } catch (error) {
    console.error('Error in playlist test API route:', error);
    return NextResponse.json(
      { success: false, message: 'Error in playlist test API route', error: (error as Error).message },
      { status: 500 }
    );
  }
} 