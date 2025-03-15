import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import dbConnect from '@/lib/mongoose';
import Playlist from '@/lib/models/playlist';
import authOptions from '@/lib/auth';

/**
 * Handles GET requests to fetch playlist statistics for the current user
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
    
    // Get total playlists
    const totalPlaylists = await Playlist.countDocuments({ userId: session.user.id });
    
    // Get total tracks
    const playlists = await Playlist.find({ userId: session.user.id });
    const totalTracks = playlists.reduce((total, playlist) => {
      return total + (playlist.tracks?.length || 0);
    }, 0);
    
    // Get last sync time
    let lastSync = 'Never';
    const latestPlaylist = await Playlist.findOne({ userId: session.user.id })
      .sort({ updatedAt: -1 });
    
    if (latestPlaylist) {
      const lastSyncDate = new Date(latestPlaylist.updatedAt);
      const now = new Date();
      const diffMs = now.getTime() - lastSyncDate.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      
      if (diffMins < 60) {
        lastSync = `${diffMins}M AGO`;
      } else if (diffMins < 1440) {
        const hours = Math.floor(diffMins / 60);
        lastSync = `${hours}H AGO`;
      } else {
        const days = Math.floor(diffMins / 1440);
        lastSync = `${days}D AGO`;
      }
    }
    
    return NextResponse.json({
      success: true,
      totalPlaylists,
      totalTracks,
      lastSync
    });
  } catch (error) {
    console.error('Error fetching playlist stats:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: 'Failed to fetch playlist statistics', 
        error: (error as Error).message 
      },
      { status: 500 }
    );
  }
} 