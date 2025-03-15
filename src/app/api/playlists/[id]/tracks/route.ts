import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { ObjectId } from 'mongodb';
import dbConnect from '@/lib/mongoose';
import Playlist from '@/lib/models/playlist';
import authOptions from '@/lib/auth';

/**
 * Handles POST requests to add tracks to a playlist
 * @param request - The incoming request object
 * @param params - The route parameters containing the playlist ID
 * @returns A response containing the updated playlist
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user.id) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    const { id } = params;
    
    if (!ObjectId.isValid(id)) {
      return NextResponse.json(
        { success: false, message: 'Invalid playlist ID' },
        { status: 400 }
      );
    }
    
    const { tracks } = await request.json();
    
    if (!Array.isArray(tracks) || tracks.length === 0) {
      return NextResponse.json(
        { success: false, message: 'No tracks provided' },
        { status: 400 }
      );
    }
    
    await dbConnect();
    
    // Find the playlist and check ownership
    const playlist = await Playlist.findById(id);
    
    if (!playlist) {
      return NextResponse.json(
        { success: false, message: 'Playlist not found' },
        { status: 404 }
      );
    }
    
    if (playlist.userId.toString() !== session.user.id) {
      return NextResponse.json(
        { success: false, message: 'Access denied' },
        { status: 403 }
      );
    }
    
    // Add tracks to the playlist
    playlist.tracks.push(...tracks);
    await playlist.save();
    
    return NextResponse.json({
      success: true,
      message: 'Tracks added successfully',
      playlist
    });
  } catch (error) {
    console.error('Error adding tracks:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to add tracks', error: (error as Error).message },
      { status: 500 }
    );
  }
}

/**
 * Handles DELETE requests to remove tracks from a playlist
 * @param request - The incoming request object
 * @param params - The route parameters containing the playlist ID
 * @returns A response containing the updated playlist
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user.id) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    const { id } = params;
    
    if (!ObjectId.isValid(id)) {
      return NextResponse.json(
        { success: false, message: 'Invalid playlist ID' },
        { status: 400 }
      );
    }
    
    const { trackIds } = await request.json();
    
    if (!Array.isArray(trackIds) || trackIds.length === 0) {
      return NextResponse.json(
        { success: false, message: 'No track IDs provided' },
        { status: 400 }
      );
    }
    
    await dbConnect();
    
    // Find the playlist and check ownership
    const playlist = await Playlist.findById(id);
    
    if (!playlist) {
      return NextResponse.json(
        { success: false, message: 'Playlist not found' },
        { status: 404 }
      );
    }
    
    if (playlist.userId.toString() !== session.user.id) {
      return NextResponse.json(
        { success: false, message: 'Access denied' },
        { status: 403 }
      );
    }
    
    // Remove tracks from the playlist
    playlist.tracks = playlist.tracks.filter((track: any) => !trackIds.includes(track._id.toString()));
    await playlist.save();
    
    return NextResponse.json({
      success: true,
      message: 'Tracks removed successfully',
      playlist
    });
  } catch (error) {
    console.error('Error removing tracks:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to remove tracks', error: (error as Error).message },
      { status: 500 }
    );
  }
} 