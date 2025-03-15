/**
 * Removes a track from the playlist
 * @param trackId - The ID of the track to remove
 */
const removeTrack = async (trackId: string) => {
  try {
    const response = await fetch(`/api/playlists/${playlistId}/tracks/${trackId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({
        error: `Server error: ${response.status} ${response.statusText}`
      }));
      console.error('Failed to remove track:', errorData);
      alert(errorData.error || 'Failed to remove track');
      return;
    }

    const data = await response.json();
    // Update the tracks state to remove the deleted track
    setTracks(tracks.filter(track => track._id !== trackId));
    alert('Track removed successfully');
  } catch (error) {
    console.error('Error removing track:', error);
    alert('Failed to remove track. Please try again.');
  }
}; 