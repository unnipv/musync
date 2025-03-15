import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import connectDB from '@/lib/mongodb';
import Playlist from "@/models/Playlist";
import mongoose from "mongoose";
import User from "@/models/User";

/**
 * Handles DELETE requests to remove a track from a playlist
 * 
 * @param request - The incoming request object
 * @param params - Object containing route parameters (id: playlist ID, trackId: track ID to remove)
 * @returns JSON response indicating success or failure
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; trackId: string } }
) {
  try {
    // Get the playlist ID and track ID from the URL parameters
    const { id, trackId } = params;
    
    // Validate that both IDs are valid MongoDB ObjectIds
    if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(trackId)) {
      return NextResponse.json(
        { success: false, error: "Invalid playlist or track ID" }, 
        { status: 400 }
      );
    }
    
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" }, 
        { status: 401 }
      );
    }
    
    // Get user ID from session
    const userId = session.user.id;
    if (!userId) {
      return NextResponse.json(
        { success: false, error: "User ID not found in session" }, 
        { status: 401 }
      );
    }
    
    // Connect to database
    await connectDB();
    
    // Find the playlist
    const playlist = await Playlist.findById(id);
    if (!playlist) {
      return NextResponse.json(
        { success: false, error: "Playlist not found" }, 
        { status: 404 }
      );
    }
    
    // Check if user owns this playlist
    if (playlist.userId.toString() !== userId) {
      return NextResponse.json(
        { success: false, error: "Not authorized to modify this playlist" }, 
        { status: 403 }
      );
    }
    
    // Check if track exists in playlist
    const trackIndex = playlist.tracks.findIndex(
      (track: any) => track._id.toString() === trackId
    );
    
    if (trackIndex === -1) {
      return NextResponse.json(
        { success: false, error: "Track not found in playlist" }, 
        { status: 404 }
      );
    }
    
    // Remove the track from the playlist
    playlist.tracks.splice(trackIndex, 1);
    await playlist.save();
    
    // Return success response
    return NextResponse.json({
      success: true,
      message: "Track removed successfully",
      trackId: trackId,
      playlistId: id
    });
  } catch (error) {
    console.error("Error removing track from playlist:", error);
    
    // Ensure we return a valid JSON response even in case of error
    return NextResponse.json(
      { 
        success: false, 
        error: "Failed to remove track from playlist",
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
} 