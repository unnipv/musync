import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { ObjectId } from 'mongodb';
import dbConnect from '@/lib/mongoose';
import Playlist from '@/models/Playlist';
import { authOptions } from '@/lib/auth';

// Define the type for the request body
interface DeleteTracksRequestBody {
  trackIds: string[];
  trackTitle?: string | null;
}

/**
 * Helper function to filter tracks for removal
 * @param track - The track to check
 * @param trackIdsToRemove - Array of track IDs to remove
 * @param titleToMatch - Optional title to match against
 * @returns true if the track should be kept, false if it should be removed
 */
const removeTrackFilter = (track: any, trackIdsToRemove: string[], titleToMatch: string | null) => {
  const trackIdStr = track._id.toString();
  const trackId = track.id || trackIdStr;
  const trackTitleInDb = track.title;
  
  // Check if this track should be removed
  let shouldRemove = false;
  
  // Try to match by MongoDB ID first
  if (trackIdsToRemove.includes(trackIdStr)) {
    shouldRemove = true;
    console.log(`Track ${trackIdStr} (${trackTitleInDb}) matched by MongoDB ID`);
  }
  // Then try to match by custom ID if it exists
  else if (track.id && trackIdsToRemove.includes(track.id)) {
    shouldRemove = true;
    console.log(`Track ${track.id} (${trackTitleInDb}) matched by custom ID`);
  }
  // Try to match by title if provided
  else if (titleToMatch && trackTitleInDb && 
          (trackTitleInDb.toLowerCase() === titleToMatch.toLowerCase() || 
           trackTitleInDb.toLowerCase().includes(titleToMatch.toLowerCase()) || 
           titleToMatch.toLowerCase().includes(trackTitleInDb.toLowerCase()))) {
    shouldRemove = true;
    console.log(`Track ${trackIdStr} (${trackTitleInDb}) matched by title comparison with "${titleToMatch}"`);
  }
  // Finally, try to match by title in trackIds
  else {
    for (const id of trackIdsToRemove) {
      // Try to extract title from composite keys like "Title-Artist-Index"
      const possibleTitle = id.split('-')[0];
      if (id.includes(trackTitleInDb) || 
          trackTitleInDb.includes(possibleTitle) || 
          possibleTitle.includes(trackTitleInDb)) {
        shouldRemove = true;
        console.log(`Track ${trackIdStr} (${trackTitleInDb}) matched by title similarity with ${id}`);
        break;
      }
    }
  }
  
  const shouldKeep = !shouldRemove;
  console.log(`Track ${trackIdStr} (${trackTitleInDb}): ${shouldKeep ? 'keeping' : 'REMOVING'}`);
  return shouldKeep;
};

/**
 * Handles POST requests to add tracks to a playlist
 * Also handles DELETE requests sent as POST
 * 
 * @param request - The incoming request object
 * @param params - The route parameters containing the playlist ID
 * @returns A response containing the updated playlist
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  console.log('POST request received for playlist:', params.id);
  console.log('Request headers:', Object.fromEntries([...request.headers.entries()]));
  
  // Check if this is actually a DELETE request sent as POST
  const methodOverride = request.headers.get('X-HTTP-Method-Override');
  
  // Clone the request to read the body
  const clonedRequest = request.clone();
  let requestText;
  try {
    requestText = await clonedRequest.text();
    console.log('Request body text:', requestText);
  } catch (error) {
    console.error('Error reading request body:', error);
  }
  
  let requestBody;
  if (requestText) {
    try {
      requestBody = JSON.parse(requestText);
      console.log('Parsed request body:', requestBody);
    } catch (error) {
      console.error('Error parsing request body:', error);
    }
  }
  
  // If this is a DELETE request sent as POST, handle it as DELETE
  if (
    methodOverride === 'DELETE' || 
    (requestBody && requestBody._method === 'DELETE')
  ) {
    console.log('Handling as DELETE request due to method override');
    return handleDeleteRequest(request, params, requestBody);
  }
  
  // Otherwise, handle as a normal POST request
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    const { id } = params;
    
    if (!ObjectId.isValid(id)) {
      return NextResponse.json(
        { success: false, error: 'Invalid playlist ID' },
        { status: 400 }
      );
    }
    
    // Parse request body safely
    let tracks;
    try {
      const body = requestBody || await request.json();
      tracks = body.tracks;
    } catch (parseError) {
      return NextResponse.json(
        { success: false, error: 'Invalid request body' },
        { status: 400 }
      );
    }
    
    if (!Array.isArray(tracks) || tracks.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No tracks provided' },
        { status: 400 }
      );
    }
    
    await dbConnect();
    
    // Find the playlist and check ownership
    const playlist = await Playlist.findById(id);
    
    if (!playlist) {
      return NextResponse.json(
        { success: false, error: 'Playlist not found' },
        { status: 404 }
      );
    }
    
    if (playlist.userId.toString() !== session.user.id) {
      return NextResponse.json(
        { success: false, error: 'Access denied' },
        { status: 403 }
      );
    }
    
    // Add tracks to the playlist
    playlist.tracks.push(...tracks);
    await playlist.save();
    
    return NextResponse.json({
      success: true,
      message: 'Tracks added successfully',
      playlistId: id,
      addedCount: tracks.length
    });
  } catch (error) {
    console.error('Error adding tracks:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to add tracks', 
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

/**
 * Helper function to handle DELETE requests (either direct or via method override)
 */
async function handleDeleteRequest(
  request: NextRequest,
  params: { id: string },
  parsedBody?: DeleteTracksRequestBody
) {
  console.log('Processing DELETE request for playlist:', params.id);
  
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user.id) {
      console.log('Unauthorized: No valid session or user ID');
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    const { id } = params;
    console.log('Playlist ID:', id);
    
    if (!ObjectId.isValid(id)) {
      console.log('Invalid playlist ID:', id);
      return NextResponse.json(
        { success: false, error: 'Invalid playlist ID' },
        { status: 400 }
      );
    }
    
    // Get trackIds from the parsed body if provided, otherwise parse the request
    let trackIds: string[] = [];
    let trackTitle: string | null = null;
    
    if (parsedBody && parsedBody.trackIds) {
      trackIds = parsedBody.trackIds;
      console.log('Using trackIds from parsed body:', trackIds);
      
      if (parsedBody.trackTitle) {
        trackTitle = parsedBody.trackTitle;
        console.log('Using trackTitle from parsed body:', trackTitle);
      }
    } else {
      try {
        // Check if the request has a body before trying to parse it
        const contentType = request.headers.get('content-type');
        console.log('Content-Type:', contentType);
        
        if (!contentType || !contentType.includes('application/json')) {
          console.log('Invalid Content-Type:', contentType);
          return NextResponse.json(
            { success: false, error: 'Content-Type must be application/json' },
            { status: 400 }
          );
        }
        
        // Clone the request before reading the body to avoid stream already read errors
        const clonedRequest = request.clone();
        const text = await clonedRequest.text();
        console.log('Request body text:', text);
        
        // Check if the body is empty
        if (!text || text.trim() === '') {
          console.log('Empty request body');
          return NextResponse.json(
            { success: false, error: 'Request body is empty' },
            { status: 400 }
          );
        }
        
        // Parse the JSON body
        const body = JSON.parse(text);
        console.log('Parsed body:', body);
        
        trackIds = body.trackIds;
        console.log('Received trackIds:', trackIds);
        
        if (!trackIds) {
          console.log('No trackIds field in request body');
          return NextResponse.json(
            { success: false, error: 'No trackIds field in request body' },
            { status: 400 }
          );
        }
      } catch (parseError) {
        console.error('Error parsing request body:', parseError);
        return NextResponse.json(
          { success: false, error: 'Invalid JSON in request body', details: String(parseError) },
          { status: 400 }
        );
      }
    }
    
    if (!Array.isArray(trackIds) || trackIds.length === 0) {
      console.log('Invalid trackIds (not an array or empty):', trackIds);
      return NextResponse.json(
        { success: false, error: 'No track IDs provided' },
        { status: 400 }
      );
    }
    
    await dbConnect();
    console.log('Connected to database');
    
    // Find the playlist and check ownership
    const playlist = await Playlist.findById(id);
    
    if (!playlist) {
      console.log('Playlist not found:', id);
      return NextResponse.json(
        { success: false, error: 'Playlist not found' },
        { status: 404 }
      );
    }
    
    if (playlist.userId.toString() !== session.user.id) {
      console.log('Access denied. User ID:', session.user.id, 'Playlist owner:', playlist.userId.toString());
      return NextResponse.json(
        { success: false, error: 'Access denied' },
        { status: 403 }
      );
    }
    
    // Count tracks before removal
    const originalTrackCount = playlist.tracks.length;
    console.log('Original track count:', originalTrackCount);
    console.log('Tracks to remove:', trackIds);
    console.log('Current tracks:', playlist.tracks.map((t: any) => ({ id: t._id.toString(), title: t.title })));
    
    // Remove tracks from the playlist
    playlist.tracks = playlist.tracks.filter(track => removeTrackFilter(track, trackIds, trackTitle));
    
    // Count removed tracks
    const removedCount = originalTrackCount - playlist.tracks.length;
    console.log('Removed track count:', removedCount);
    
    // Save the updated playlist
    await playlist.save();
    console.log('Playlist saved successfully');
    
    const response = {
      success: true,
      message: 'Tracks removed successfully',
      playlistId: id,
      removedCount: removedCount
    };
    console.log('Response:', response);
    
    return NextResponse.json(response);
  } catch (error) {
    console.error('Error removing tracks:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to remove tracks', 
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

/**
 * Handles DELETE requests to remove tracks from a playlist
 * 
 * @param request - The incoming request object
 * @param params - The route parameters containing the playlist ID
 * @returns A response containing the updated playlist
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  console.log('DELETE request received for playlist:', params.id);
  console.log('Request headers:', Object.fromEntries([...request.headers.entries()]));
  console.log('Request URL:', request.url);
  
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user.id) {
      console.log('Unauthorized: No valid session or user ID');
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    const { id } = params;
    console.log('Playlist ID:', id);
    
    if (!ObjectId.isValid(id)) {
      console.log('Invalid playlist ID:', id);
      return NextResponse.json(
        { success: false, error: 'Invalid playlist ID' },
        { status: 400 }
      );
    }
    
    // Get trackIds from query parameters
    const url = new URL(request.url);
    const trackId = url.searchParams.get('trackId');
    console.log('Track ID from query parameter:', trackId);
    
    let trackIds: string[] = [];
    let trackTitle: string | null = null;
    
    if (trackId) {
      // Single track ID from query parameter
      trackIds = [trackId];
      console.log('Using track ID from query parameter:', trackIds);
    } else {
      // Try to get trackIds from request body
      try {
        // Check if the request has a body before trying to parse it
        const contentType = request.headers.get('content-type');
        console.log('Content-Type:', contentType);
        
        if (contentType && contentType.includes('application/json')) {
          // Clone the request before reading the body to avoid stream already read errors
          const clonedRequest = request.clone();
          const text = await clonedRequest.text();
          console.log('Request body text:', text);
          
          // Check if the body is empty
          if (text && text.trim() !== '') {
            // Parse the JSON body
            const body = JSON.parse(text);
            console.log('Parsed body:', body);
            
            if (body.trackIds && Array.isArray(body.trackIds)) {
              trackIds = body.trackIds;
              console.log('Using trackIds from request body:', trackIds);
            }
            
            if (body.trackTitle) {
              trackTitle = body.trackTitle;
              console.log('Using trackTitle from request body:', trackTitle);
            }
          }
        }
      } catch (parseError) {
        console.error('Error parsing request body:', parseError);
      }
    }
    
    if (trackIds.length === 0) {
      console.log('No track IDs provided');
      return NextResponse.json(
        { success: false, error: 'No track IDs provided' },
        { status: 400 }
      );
    }
    
    await dbConnect();
    console.log('Connected to database');
    
    // Find the playlist and check ownership
    const playlist = await Playlist.findById(id);
    
    if (!playlist) {
      console.log('Playlist not found:', id);
      return NextResponse.json(
        { success: false, error: 'Playlist not found' },
        { status: 404 }
      );
    }
    
    if (playlist.userId.toString() !== session.user.id) {
      console.log('Access denied. User ID:', session.user.id, 'Playlist owner:', playlist.userId.toString());
      return NextResponse.json(
        { success: false, error: 'Access denied' },
        { status: 403 }
      );
    }
    
    // Count tracks before removal
    const originalTrackCount = playlist.tracks.length;
    console.log('Original track count:', originalTrackCount);
    console.log('Tracks to remove:', trackIds);
    console.log('Current tracks:', playlist.tracks.map((t: any) => ({ id: t._id.toString(), title: t.title })));
    
    // Remove tracks from the playlist
    playlist.tracks = playlist.tracks.filter(track => removeTrackFilter(track, trackIds, trackTitle));
    
    // Count removed tracks
    const removedCount = originalTrackCount - playlist.tracks.length;
    console.log('Removed track count:', removedCount);
    
    // Save the updated playlist
    await playlist.save();
    console.log('Playlist saved successfully');
    
    const response = {
      success: true,
      message: 'Tracks removed successfully',
      playlistId: id,
      removedCount: removedCount
    };
    console.log('Response:', response);
    
    return NextResponse.json(response);
  } catch (error) {
    console.error('Error removing tracks:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to remove tracks', 
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}