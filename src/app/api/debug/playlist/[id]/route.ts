import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { ObjectId } from 'mongodb';
import authOptions from '@/lib/auth';
import dbConnect from '@/lib/mongoose';
import Playlist from '@/lib/models/playlist';

/**
 * Debug endpoint to get raw playlist data
 * 
 * @param request - The incoming request
 * @param params - The route parameters containing the playlist ID
 * @returns The raw playlist data
 */
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    if (!ObjectId.isValid(params.id)) {
      return NextResponse.json({ error: 'Invalid playlist ID' }, { status: 400 });
    }
    
    await dbConnect();
    
    const playlist = await Playlist.findById(params.id).lean();
    
    if (!playlist) {
      return NextResponse.json({ error: 'Playlist not found' }, { status: 404 });
    }
    
    if (playlist.userId.toString() !== session.user.id && !playlist.isPublic) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }
    
    return NextResponse.json({
      playlist: JSON.parse(JSON.stringify(playlist)),
      hasTracksProp: !!playlist.tracks,
      trackCount: playlist.tracks?.length || 0,
      hasSongsProp: !!playlist.songs,
      songCount: playlist.songs?.length || 0
    });
  } catch (error) {
    console.error('Error fetching playlist:', error);
    return NextResponse.json(
      { error: 'Failed to fetch playlist' },
      { status: 500 }
    );
  }
} 