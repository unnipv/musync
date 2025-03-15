import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import authOptions from '@/lib/auth';
import dbConnect from '@/lib/mongoose';
import User from '@/lib/models/user';
import Playlist from '@/lib/models/playlist';

/**
 * Retrieves the user profile information
 * 
 * @param request - The incoming request
 * @returns The user profile data
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    await dbConnect();
    
    // Get user data
    const user = await User.findById(session.userId).lean();
    
    if (!user) {
      console.log('User not found in database, creating basic profile with session data:', session);
      // If user not found in database but we have a session, create a basic user record
      return NextResponse.json({
        name: session.user.name || 'User',
        email: session.user.email || '',
        image: session.user.image || '',
        platforms: [],
        playlists: []
      });
    }
    
    // Get user's playlists
    const playlists = await Playlist.find({ userId: session.userId })
      .select('name description tracks')
      .lean();
    
    // Format playlist data for the response
    const formattedPlaylists = playlists.map(playlist => ({
      _id: playlist._id.toString(),
      name: playlist.name || 'Untitled Playlist',
      description: playlist.description || '',
      trackCount: playlist.tracks?.length || 0
    }));
    
    // Ensure platforms is always an array
    const platforms = user.platforms || [];
    
    return NextResponse.json({
      name: user.name || 'User',
      email: user.email || '',
      image: user.image || '',
      platforms: platforms,
      playlists: formattedPlaylists
    });
  } catch (error) {
    console.error('Error fetching user profile:', error);
    // Return a basic profile with error info to prevent UI from breaking
    return NextResponse.json({
      name: session?.user?.name || 'User',
      email: session?.user?.email || '',
      image: session?.user?.image || '',
      error: (error as Error).message,
      platforms: [],
      playlists: []
    });
  }
}

/**
 * Handles PUT requests to update the current user's profile
 * @param request - The incoming request object
 * @returns A response containing the updated user profile
 */
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !session.userId) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    const { name } = await request.json();
    
    if (!name) {
      return NextResponse.json(
        { success: false, message: 'Name is required' },
        { status: 400 }
      );
    }
    
    await dbConnect();
    
    const user = await User.findById(session.userId);
    
    if (!user) {
      return NextResponse.json(
        { success: false, message: 'User not found' },
        { status: 404 }
      );
    }
    
    // Update user profile
    user.name = name;
    await user.save();
    
    return NextResponse.json({
      success: true,
      message: 'Profile updated successfully',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        platforms: user.platforms || []
      }
    });
  } catch (error) {
    console.error('Error updating user profile:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: 'Failed to update user profile', 
        error: (error as Error).message 
      },
      { status: 500 }
    );
  }
} 