import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/mongodb';
import Playlist from '@/models/Playlist';
import mongoose from 'mongoose';

/**
 * Connects a platform to a playlist
 * 
 * @param request - The incoming request
 * @param params - Object containing the playlist ID and platform
 * @returns JSON response indicating connection status
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string; platform: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Validate playlist ID
    if (!mongoose.Types.ObjectId.isValid(params.id)) {
      return NextResponse.json(
        { error: 'Invalid playlist ID' },
        { status: 400 }
      );
    }

    // Verify platform is valid
    if (!['spotify', 'youtube'].includes(params.platform)) {
      return NextResponse.json(
        { error: 'Invalid platform' },
        { status: 400 }
      );
    }

    // Find the playlist and ensure it belongs to the current user
    const playlist = await Playlist.findOne({
      _id: params.id,
      userId: session.user.id
    });
    
    if (!playlist) {
      return NextResponse.json(
        { error: 'Playlist not found' },
        { status: 404 }
      );
    }

    // Get platform-specific data
    let platformId = '';
    let accessToken = '';
    
    if (params.platform === 'spotify') {
      if (!session.user.spotifyAccessToken) {
        return NextResponse.json(
          { error: 'No Spotify access token available' },
          { status: 400 }
        );
      }
      
      accessToken = session.user.spotifyAccessToken;
      
      // Get user's Spotify ID
      const response = await fetch('https://api.spotify.com/v1/me', {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      });
      
      if (!response.ok) {
        const error = await response.text();
        return NextResponse.json(
          { error: `Failed to get Spotify user profile: ${error}` },
          { status: response.status }
        );
      }
      
      const profile = await response.json();
      platformId = profile.id;
    } else if (params.platform === 'youtube') {
      if (!session.user.googleAccessToken) {
        return NextResponse.json(
          { error: 'No YouTube access token available' },
          { status: 400 }
        );
      }
      
      accessToken = session.user.googleAccessToken;
      
      // Get user's YouTube channel ID
      const response = await fetch('https://www.googleapis.com/youtube/v3/channels?part=id&mine=true', {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      });
      
      if (!response.ok) {
        const error = await response.text();
        return NextResponse.json(
          { error: `Failed to get YouTube channel: ${error}` },
          { status: response.status }
        );
      }
      
      const data = await response.json();
      platformId = data.items?.[0]?.id || '';
      
      if (!platformId) {
        return NextResponse.json(
          { error: 'No YouTube channel found for user' },
          { status: 400 }
        );
      }
    }

    // Check if this platform is already connected to the playlist
    const platformIndex = playlist.platformData?.findIndex(
      (data: any) => data.platform === params.platform
    );
    
    if (platformIndex !== undefined && platformIndex >= 0) {
      // Update existing platform data
      if (!playlist.platformData) {
        playlist.platformData = [];
      }
      
      playlist.platformData[platformIndex] = {
        ...playlist.platformData[platformIndex],
        platformId,
        lastSyncedAt: new Date(),
        syncStatus: 'connected'
      };
    } else {
      // Add new platform data
      if (!playlist.platformData) {
        playlist.platformData = [];
      }
      
      playlist.platformData.push({
        platform: params.platform,
        id: platformId,
        platformId,
        lastSyncedAt: new Date(),
        syncStatus: 'connected'
      });
    }
    
    // For backward compatibility, also set the platform-specific ID field
    if (params.platform === 'spotify') {
      playlist.spotifyId = platformId;
    } else if (params.platform === 'youtube') {
      playlist.youtubeId = platformId;
    }
    
    await playlist.save();
    
    return NextResponse.json({
      success: true,
      message: `Connected ${params.platform} to playlist`,
      platformId
    });
  } catch (error) {
    console.error(`Error connecting ${params.platform} to playlist:`, error);
    return NextResponse.json(
      { error: `Failed to connect ${params.platform}: ${(error as Error).message}` },
      { status: 500 }
    );
  }
}

/**
 * Disconnects a platform from a playlist
 * 
 * @param request - The incoming request
 * @param params - Object containing the playlist ID and platform
 * @returns JSON response indicating disconnection status
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; platform: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Validate playlist ID
    if (!mongoose.Types.ObjectId.isValid(params.id)) {
      return NextResponse.json(
        { error: 'Invalid playlist ID' },
        { status: 400 }
      );
    }

    // Verify platform is valid
    if (!['spotify', 'youtube'].includes(params.platform)) {
      return NextResponse.json(
        { error: 'Invalid platform' },
        { status: 400 }
      );
    }

    // Find the playlist and ensure it belongs to the current user
    const playlist = await Playlist.findOne({
      _id: params.id,
      userId: session.user.id
    });
    
    if (!playlist) {
      return NextResponse.json(
        { error: 'Playlist not found' },
        { status: 404 }
      );
    }

    // Remove the platform data
    if (playlist.platformData) {
      playlist.platformData = playlist.platformData.filter(
        (data: any) => data.platform !== params.platform
      );
    }
    
    // For backward compatibility, also clear the platform-specific ID field
    if (params.platform === 'spotify') {
      playlist.spotifyId = undefined;
    } else if (params.platform === 'youtube') {
      playlist.youtubeId = undefined;
    }
    
    await playlist.save();
    
    return NextResponse.json({
      success: true,
      message: `Disconnected ${params.platform} from playlist`
    });
  } catch (error) {
    console.error(`Error disconnecting ${params.platform} from playlist:`, error);
    return NextResponse.json(
      { error: `Failed to disconnect ${params.platform}: ${(error as Error).message}` },
      { status: 500 }
    );
  }
} 