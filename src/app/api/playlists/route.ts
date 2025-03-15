import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import authOptions from '@/lib/auth';
import dbConnect from '@/lib/mongoose';
import Playlist from '@/lib/models/playlist';

/**
 * Handles GET requests to fetch all playlists for the current user
 * 
 * @param request - The incoming request
 * @returns A response containing the user's playlists
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    await dbConnect();
    
    const playlists = await Playlist.find({ userId: session.user.id })
      .sort({ updatedAt: -1 })
      .lean();
    
    return NextResponse.json({ playlists });
  } catch (error) {
    console.error('Error fetching playlists:', error);
    return NextResponse.json(
      { error: 'Failed to fetch playlists', details: (error as Error).message },
      { status: 500 }
    );
  }
}

/**
 * Handles POST requests to create a new playlist
 * 
 * @param request - The incoming request with playlist data
 * @returns A response containing the created playlist
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { name, description, isPublic = true } = await request.json();
    
    if (!name) {
      return NextResponse.json({ error: 'Playlist name is required' }, { status: 400 });
    }
    
    await dbConnect();
    
    const playlist = await Playlist.create({
      name,
      description,
      isPublic,
      userId: session.user.id,
      tracks: [],
      platformData: []
    });
    
    return NextResponse.json({
      message: 'Playlist created successfully',
      playlist: JSON.parse(JSON.stringify(playlist))
    });
  } catch (error) {
    console.error('Error creating playlist:', error);
    return NextResponse.json(
      { error: 'Failed to create playlist', details: (error as Error).message },
      { status: 500 }
    );
  }
} 