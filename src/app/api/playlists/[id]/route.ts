import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { ObjectId } from 'mongodb';
import dbConnect from '@/lib/mongoose';
import Playlist from '@/lib/models/playlist';
import authOptions from '@/lib/auth';

/**
 * Handles GET requests to fetch a specific playlist
 * @param request - The incoming request object
 * @param params - The route parameters containing the playlist ID
 * @returns A response containing the requested playlist
 */
export async function GET(
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
    
    await dbConnect();
    
    const playlist = await Playlist.findById(id);
    
    if (!playlist) {
      return NextResponse.json(
        { success: false, message: 'Playlist not found' },
        { status: 404 }
      );
    }
    
    // Check if the user owns the playlist or if it's public
    if (playlist.userId.toString() !== session.user.id && !playlist.isPublic) {
      return NextResponse.json(
        { success: false, message: 'Access denied' },
        { status: 403 }
      );
    }
    
    return NextResponse.json({
      success: true,
      playlist
    });
  } catch (error) {
    console.error('Error fetching playlist:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to fetch playlist', error: (error as Error).message },
      { status: 500 }
    );
  }
}

/**
 * Handles PUT requests to update a specific playlist
 * @param request - The incoming request object
 * @param params - The route parameters containing the playlist ID
 * @returns A response containing the updated playlist
 */
export async function PUT(
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
    
    const updateData = await request.json();
    
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
    
    // Update the playlist
    Object.assign(playlist, updateData);
    await playlist.save();
    
    return NextResponse.json({
      success: true,
      message: 'Playlist updated successfully',
      playlist
    });
  } catch (error) {
    console.error('Error updating playlist:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to update playlist', error: (error as Error).message },
      { status: 500 }
    );
  }
}

/**
 * Handles DELETE requests to remove a specific playlist
 * @param request - The incoming request object
 * @param params - The route parameters containing the playlist ID
 * @returns A response indicating whether the deletion was successful
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
    
    // Delete the playlist
    await Playlist.findByIdAndDelete(id);
    
    return NextResponse.json({
      success: true,
      message: 'Playlist deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting playlist:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to delete playlist', error: (error as Error).message },
      { status: 500 }
    );
  }
} 