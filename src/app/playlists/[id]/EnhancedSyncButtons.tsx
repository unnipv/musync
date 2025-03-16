'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface EnhancedSyncButtonsProps {
  playlistId: string;
  spotifyConnected: boolean;
  youtubeConnected: boolean;
  spotifyId?: string;
  youtubeId?: string;
}

/**
 * Component providing enhanced sync options for a playlist
 * 
 * @param playlistId - The ID of the playlist to synchronize
 * @param spotifyConnected - Whether the playlist is connected to Spotify
 * @param youtubeConnected - Whether the playlist is connected to YouTube
 * @param spotifyId - The ID of the playlist on Spotify
 * @param youtubeId - The ID of the playlist on YouTube
 * @returns A component with buttons for different sync options
 */
export default function EnhancedSyncButtons({ 
  playlistId, 
  spotifyConnected, 
  youtubeConnected,
  spotifyId,
  youtubeId
}: EnhancedSyncButtonsProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [unavailableTracks, setUnavailableTracks] = useState<{
    spotify: string[];
    youtube: string[];
  }>({ spotify: [], youtube: [] });
  const [syncDetails, setSyncDetails] = useState<{
    added?: { spotify?: number, youtube?: number };
    updated?: { spotify?: number, youtube?: number };
    platformLinks?: { spotify?: string, youtube?: string };
  }>({});
  const [createdPlatforms, setCreatedPlatforms] = useState<{
    spotify: boolean;
    youtube: boolean;
  }>({ spotify: false, youtube: false });
  const [debugInfo, setDebugInfo] = useState<{
    responseYouTubeUrl?: string;
    responsePlatformUrlsYouTube?: string;
  }>({});
  
  /**
   * Handles synchronizing the playlist with specified platforms
   * 
   * @param platforms - Platforms to sync with ('all', 'spotify', or 'youtube')
   */
  const handleSync = async (platforms: 'all' | 'spotify' | 'youtube') => {
    // Reset state
    setIsLoading(platforms);
    setError(null);
    setSuccess(null);
    setUnavailableTracks({ spotify: [], youtube: [] });
    setSyncDetails({});
    setCreatedPlatforms({ spotify: false, youtube: false });
    
    try {
      const response = await fetch(`/api/playlists/${playlistId}/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          platforms
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to synchronize playlist');
      }

      console.log("SYNC RESPONSE DATA:", JSON.stringify(data, null, 2));
      
      // Process sync results - COMPLETELY REBUILD THIS
      interface SyncDetails {
        added: {
          spotify?: number; 
          youtube?: number;
          [key: string]: number | undefined;
        };
        updated: {
          spotify?: number;
          youtube?: number;
          [key: string]: number | undefined;
        };
        platformLinks: {
          spotify?: string;
          youtube?: string;
        };
      }
      
      const details: SyncDetails = {
        added: {},
        updated: {},
        platformLinks: {}
      };

      // Enhanced debugging for YouTube URL sources
      console.log("YOUTUBE URL SOURCES:", {
        "data.youtubeUrl": data.youtubeUrl,
        "data.platformUrls?.youtube": data.platformUrls?.youtube,
        "data.syncResult?.youtube?.youtubeUrl": data.syncResult?.youtube?.youtubeUrl,
        "data.syncResult?.youtube?.playlistUrl": data.syncResult?.youtube?.playlistUrl,
        "youtubeId prop": youtubeId,
        "constructed URL": youtubeId ? `https://www.youtube.com/playlist?list=${youtubeId}` : null
      });

      // IMPORTANT: Directly set platform links from response data first
      if (data.spotifyUrl) {
        details.platformLinks.spotify = data.spotifyUrl;
        console.log("Setting Spotify URL from data.spotifyUrl:", data.spotifyUrl);
      }
      
      if (data.youtubeUrl) {
        details.platformLinks.youtube = data.youtubeUrl;
        console.log("Setting YouTube URL from data.youtubeUrl:", data.youtubeUrl);
      }
      
      // Also take from platformUrls if available
      if (data.platformUrls?.spotify) {
        details.platformLinks.spotify = data.platformUrls.spotify;
        console.log("Setting Spotify URL from data.platformUrls.spotify:", data.platformUrls.spotify);
      }
      
      if (data.platformUrls?.youtube) {
        details.platformLinks.youtube = data.platformUrls.youtube;
        console.log("Setting YouTube URL from data.platformUrls.youtube:", data.platformUrls.youtube);
      }

      // Try to extract from sync results if not found elsewhere
      if (!details.platformLinks.youtube && data.syncResult?.youtube?.youtubeUrl) {
        details.platformLinks.youtube = data.syncResult.youtube.youtubeUrl;
        console.log("Setting YouTube URL from syncResult.youtube.youtubeUrl:", data.syncResult.youtube.youtubeUrl);
      }

      if (!details.platformLinks.youtube && data.syncResult?.youtube?.playlistUrl) {
        details.platformLinks.youtube = data.syncResult.youtube.playlistUrl;
        console.log("Setting YouTube URL from syncResult.youtube.playlistUrl:", data.syncResult.youtube.playlistUrl);
      }
      
      // Fallback to using IDs directly
      if (!details.platformLinks.spotify && spotifyId) {
        details.platformLinks.spotify = `https://open.spotify.com/playlist/${spotifyId}`;
        console.log("Falling back to constructing Spotify URL from spotifyId:", spotifyId);
      }
      
      if (!details.platformLinks.youtube && youtubeId) {
        details.platformLinks.youtube = `https://www.youtube.com/playlist?list=${youtubeId}`;
        console.log("Falling back to constructing YouTube URL from youtubeId:", youtubeId);
      }
      
      console.log("PLATFORM LINKS AFTER PROCESSING:", JSON.stringify(details.platformLinks, null, 2));
      
      // Process the rest of the sync data
      // Track created platforms
      const newCreatedPlatforms = { spotify: false, youtube: false };
      
      // Check if platforms were created
      if (data.syncResult?.spotify?.created || data.results?.spotify?.created) {
        newCreatedPlatforms.spotify = true;
      }
      
      if (data.syncResult?.youtube?.created || data.results?.youtube?.created) {
        newCreatedPlatforms.youtube = true;
      }
      
      setCreatedPlatforms(newCreatedPlatforms);
      
      // Check for unavailable tracks in the response
      if (data.results || data.syncResult) {
        const unavailable = { spotify: [], youtube: [] };
        const results = data.results || data.syncResult;
        
        // Process Spotify results
        if (results.spotify) {
          if (results.spotify.unavailableTracks) {
            unavailable.spotify = results.spotify.unavailableTracks.map((t: any) => 
              `${t.title} - ${t.artist}`
            );
          }
          
          details.added.spotify = results.spotify.added || 0;
          details.updated.spotify = results.spotify.updated || 0;
        }
        
        // Process YouTube results
        if (results.youtube) {
          if (results.youtube.unavailableTracks) {
            unavailable.youtube = results.youtube.unavailableTracks.map((t: any) => 
              `${t.title} - ${t.artist}`
            );
          }
          
          details.added.youtube = results.youtube.added || 0;
          details.updated.youtube = results.youtube.updated || 0;
        }
        
        setUnavailableTracks(unavailable);
      }
      
      // Determine sync success message based on platforms attempted and their results
      let successMessage = '';
      
      if (platforms === 'all') {
        if (data.platforms) {
          if (data.platforms.spotify && data.platforms.youtube) {
            successMessage = 'Playlist synchronized with both Spotify and YouTube successfully!';
          } else if (data.platforms.spotify) {
            successMessage = 'Playlist synchronized with Spotify successfully! YouTube sync failed.';
          } else if (data.platforms.youtube) {
            successMessage = 'Playlist synchronized with YouTube successfully! Spotify sync failed.';
          } else {
            successMessage = 'Playlist synchronization was attempted but no platforms were successfully updated.';
          }
        } else {
          successMessage = 'Playlist synchronization completed - check details below for results.';
        }
      } else if (platforms === 'spotify') {
        if (data.platforms?.spotify || data.syncResult?.spotify?.success) {
          successMessage = 'Synchronized with Spotify successfully!';
        } else {
          successMessage = 'Spotify synchronization was attempted but failed.';
        }
      } else if (platforms === 'youtube') {
        if (data.platforms?.youtube || data.syncResult?.youtube?.success) {
          successMessage = 'Synchronized with YouTube successfully!';
        } else {
          successMessage = 'YouTube synchronization was attempted but failed.';
        }
      }
      
      setSuccess(successMessage);
      setSyncDetails(details);
      
      // Update debug info
      setDebugInfo({
        responseYouTubeUrl: data.youtubeUrl,
        responsePlatformUrlsYouTube: data.platformUrls?.youtube,
      });
      
      // Refresh the page after a short delay, with immediate refresh if platforms were created
      setTimeout(() => {
        router.refresh();
        
        // If platforms were created, we need to reload the page to update UI
        if (newCreatedPlatforms.spotify || newCreatedPlatforms.youtube) {
          window.location.reload();
        }
      }, 2000);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(null);
    }
  };
  
  // Determine which buttons should be enabled
  const canSyncAll = spotifyConnected && youtubeConnected;
  const canSyncSpotify = spotifyConnected;
  const canSyncYoutube = youtubeConnected;
  
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <div className="relative">
          <button 
            onClick={() => handleSync('all')}
            className={`pixel-button ${!canSyncAll ? 'opacity-50 cursor-not-allowed' : ''}`}
            disabled={!canSyncAll || isLoading !== null}
            title={!canSyncAll ? "Connect to both platforms first" : "Sync with all platforms"}
          >
            {isLoading === 'all' ? 'SYNCING ALL...' : 'SYNC ALL'}
          </button>
        </div>
        
        <div className="relative">
          <button 
            onClick={() => handleSync('spotify')}
            className={`pixel-button ${!canSyncSpotify ? 'opacity-50 cursor-not-allowed' : ''}`}
            disabled={!canSyncSpotify || isLoading !== null}
            title={!canSyncSpotify ? "Connect to Spotify first" : "Sync with Spotify only"}
          >
            {isLoading === 'spotify' ? 'SYNCING SPOTIFY...' : 'SYNC SPOTIFY'}
          </button>
        </div>
        
        <div className="relative">
          <button 
            onClick={() => handleSync('youtube')}
            className={`pixel-button ${!canSyncYoutube ? 'opacity-50 cursor-not-allowed' : ''}`}
            disabled={!canSyncYoutube || isLoading !== null}
            title={!canSyncYoutube ? "Connect to YouTube first" : "Sync with YouTube only"}
          >
            {isLoading === 'youtube' ? 'SYNCING YOUTUBE...' : 'SYNC YOUTUBE'}
          </button>
        </div>
      </div>
      
      {error && (
        <div className="bg-red-500 text-white p-3 rounded font-retro text-sm">
          {error}
        </div>
      )}
      
      {success && (
        <div className="bg-green-500 text-white p-3 rounded font-retro text-sm space-y-2">
          <p>{success}</p>
          
          {/* Show sync details */}
          {syncDetails.added && (Object.values(syncDetails.added).some(val => val && val > 0) || 
                                Object.values(syncDetails.updated || {}).some(val => val && val > 0)) && (
            <div className="text-sm bg-green-600 p-2 rounded">
              <p className="font-bold mb-1">Sync Results:</p>
              <ul className="list-disc list-inside">
                {syncDetails.added?.spotify !== undefined && (
                  <li>
                    {createdPlatforms.spotify ? 'Created new Spotify playlist, ' : ''}
                    Added {syncDetails.added.spotify} tracks to Spotify
                    {syncDetails.updated?.spotify ? ` (${syncDetails.updated.spotify} updated)` : ''}
                  </li>
                )}
                {syncDetails.added?.youtube !== undefined && (
                  <li>
                    {createdPlatforms.youtube ? 'Created new YouTube playlist, ' : ''}
                    Added {syncDetails.added.youtube} tracks to YouTube
                    {syncDetails.updated?.youtube ? ` (${syncDetails.updated.youtube} updated)` : ''}
                  </li>
                )}
              </ul>
            </div>
          )}
          
          {/* DEBUG INFO */}
          <div className="text-xs bg-black p-2 rounded mb-2">
            <h4>DEBUG INFO:</h4>
            <div>youtubeId prop: <strong>{youtubeId || 'None'}</strong></div>
            <div>Response YouTube URL: {debugInfo.responseYouTubeUrl || 'None'}</div>
            <div>Response platformUrls.youtube: {debugInfo.responsePlatformUrlsYouTube || 'None'}</div>
            <div>syncDetails YouTube URL: {syncDetails.platformLinks?.youtube || 'None'}</div>
            <div>spotifyId prop: <strong>{spotifyId || 'None'}</strong></div>
            <div>spotifyConnected: {spotifyConnected ? 'Yes' : 'No'}</div>
            <div>youtubeConnected: {youtubeConnected ? 'Yes' : 'No'}</div>
            <div>Using URL: <strong>{`https://www.youtube.com/playlist?list=${youtubeId}`}</strong></div>
          </div>

          {/* SIMPLIFIED PLATFORM LINKS - Always show if ID exists */}
          <div className="text-sm bg-green-600 p-2 rounded mb-2">
            <p className="font-bold mb-1">Your Playlists:</p>
            <div className="flex flex-col gap-2">
              {/* ALWAYS show Spotify button if ID exists */}
              {spotifyId && (
                <a 
                  href={`https://open.spotify.com/playlist/${spotifyId}`} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="bg-[#1DB954] text-black px-3 py-1 rounded inline-block w-fit hover:bg-opacity-90"
                >
                  Open in Spotify
                </a>
              )}
              
              {/* ALWAYS show YouTube button if ID exists */}
              {youtubeId && (
                <a 
                  href={`https://www.youtube.com/playlist?list=${youtubeId}`} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="bg-[#FF0000] text-white px-3 py-1 rounded inline-block w-fit hover:bg-opacity-90"
                >
                  Open in YouTube
                </a>
              )}
            </div>
          </div>
        </div>
      )}
      
      {/* Display unavailable tracks if any */}
      {(unavailableTracks.spotify.length > 0 || unavailableTracks.youtube.length > 0) && (
        <div className="bg-yellow-500 text-black p-3 rounded font-retro text-sm">
          <h4 className="font-bold mb-2">Some tracks couldn't be found on all platforms:</h4>
          
          {unavailableTracks.spotify.length > 0 && (
            <div className="mb-2">
              <p className="font-bold">Not available on Spotify:</p>
              <ul className="list-disc list-inside">
                {unavailableTracks.spotify.map((track, i) => (
                  <li key={`spotify-${i}`}>{track}</li>
                ))}
              </ul>
            </div>
          )}
          
          {unavailableTracks.youtube.length > 0 && (
            <div>
              <p className="font-bold">Not available on YouTube:</p>
              <ul className="list-disc list-inside">
                {unavailableTracks.youtube.map((track, i) => (
                  <li key={`youtube-${i}`}>{track}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
} 