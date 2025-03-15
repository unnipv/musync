import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import connectDB from '@/lib/mongodb';
import Playlist from "@/models/Playlist";
import mongoose from "mongoose";
import User from "@/models/User";

/**
 * Handles DELETE requests to remove a track from a playlist
 * @param request - The incoming request object
 * @param params - Object containing route parameters (id: playlist ID, trackId: track ID to remove)
 * @returns JSON response indicating success or failure
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; trackId: string } }
) {
  try {
    console.log(`Attempting to delete track ${params.trackId} from playlist ${params.id}`);
    
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user) {
      console.log("Unauthorized: No valid session");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Log the session user to debug
    console.log("Session user:", JSON.stringify(session.user, null, 2));
    
    // Get user ID from session or fetch from database
    let userId = session.user.id;
    
    // If user ID is not in session, try to get it from the database
    if (!userId && session.user.email) {
      await connectDB();
      const user = await User.findOne({ email: session.user.email });
      if (user) {
        userId = user._id.toString();
        console.log(`Found user ID from database: ${userId}`);
      }
    }
    
    if (!userId) {
      console.log("User ID is missing from session and couldn't be found in database");
      return NextResponse.json({ error: "User ID not found" }, { status: 401 });
    }

    await connectDB();
    console.log("Connected to database");
    
    const { id, trackId } = params;
    
    // Validate that both IDs are valid MongoDB ObjectIds
    if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(trackId)) {
      console.log(`Invalid IDs: playlist=${id}, track=${trackId}`);
      return NextResponse.json({ error: "Invalid playlist or track ID" }, { status: 400 });
    }

    // Find the playlist and check if user has permission
    const playlist = await Playlist.findById(id);
    
    if (!playlist) {
      console.log(`Playlist not found: ${id}`);
      return NextResponse.json({ error: "Playlist not found" }, { status: 404 });
    }
    
    console.log(`Found playlist: ${playlist.name}`);
    console.log(`Playlist owner: ${playlist.userId.toString()}, Current user: ${userId}`);
    
    // Check if user owns this playlist
    if (playlist.userId.toString() !== userId.toString()) {
      console.log(`Authorization failed: User ${userId} does not own playlist ${id} (owned by ${playlist.userId})`);
      return NextResponse.json({ error: "Not authorized to modify this playlist" }, { status: 403 });
    }
    
    // Check if track exists in playlist
    const trackExists = playlist.tracks.some((track: any) => track._id.toString() === trackId);
    if (!trackExists) {
      console.log(`Track ${trackId} not found in playlist ${id}`);
      return NextResponse.json({ error: "Track not found in playlist" }, { status: 404 });
    }
    
    // Remove the track from the playlist
    const updatedPlaylist = await Playlist.findByIdAndUpdate(
      id,
      { $pull: { tracks: { _id: trackId } } },
      { new: true }
    );
    
    if (!updatedPlaylist) {
      console.log("Failed to update playlist");
      return NextResponse.json({ error: "Failed to update playlist" }, { status: 500 });
    }
    
    console.log(`Successfully removed track ${trackId} from playlist ${id}`);
    return NextResponse.json({ 
      success: true, 
      message: "Track removed successfully",
      playlist: updatedPlaylist 
    });
  } catch (error) {
    console.error("Error removing track from playlist:", error);
    return NextResponse.json(
      { error: "Failed to remove track from playlist", details: String(error) },
      { status: 500 }
    );
  }
} 