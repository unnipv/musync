import React, { useState } from 'react';
import { useSession } from 'next-auth/react';

interface SyncStatusProps {
  playlistId: string;
  spotifyConnected: boolean;
  youtubeConnected: boolean;
  lastSyncedAt?: Date | null;
  spotifyId?: string;
  youtubeId?: string;
}

/**
 * Component that displays synchronization status and controls
 * 
 * @param props - Component properties
 * @returns React component
 */
export default function SyncStatus({
  playlistId,
  spotifyConnected,
  youtubeConnected,
  lastSyncedAt,
  spotifyId,
  youtubeId
}: SyncStatusProps) {
  const { data: session } = useSession();
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [platformUrls, setPlatformUrls] = useState<{
    spotify?: string;
    youtube?: string;
  }>({
    spotify: spotifyId ? `https://open.spotify.com/playlist/${spotifyId}` : undefined,
    youtube: youtubeId ? `https://www.youtube.com/playlist?list=${youtubeId}` : undefined
  });

  /**
   * Formats a date in a retro computer style
   * 
   * @param date - Date to format
   * @returns Formatted date string
   */
  const formatDate = (date: Date | null | undefined) => {
    if (!date) return 'NEVER';
    return new Date(date).toLocaleString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    }).replace(/,/g, '');
  };

  /**
   * Initiates playlist synchronization
   */
  const handleSync = async () => {
    if (!session || isSyncing) return;
    
    setIsSyncing(true);
    setError(null);
    setSyncResult(null);
    
    try {
      const response = await fetch(`/api/playlists/${playlistId}/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          platforms: spotifyConnected && youtubeConnected ? 'all' : 
                     spotifyConnected ? 'spotify' : 'youtube' 
        })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to synchronize playlist');
      }
      
      setSyncResult(data);
      
      // Extract platform URLs from the response
      const newUrls: {spotify?: string, youtube?: string} = {...platformUrls};
      
      // Check for Spotify URL
      if (data.spotifyUrl) {
        newUrls.spotify = data.spotifyUrl;
      } else if (data.syncResult?.spotify?.spotifyUrl) {
        newUrls.spotify = data.syncResult.spotify.spotifyUrl;
      } else if (data.platformUrls?.spotify) {
        newUrls.spotify = data.platformUrls.spotify;
      } else if (data.syncResult?.spotify?.playlistUrl) {
        newUrls.spotify = data.syncResult.spotify.playlistUrl;
      }
      
      // Check for YouTube URL
      if (data.youtubeUrl) {
        newUrls.youtube = data.youtubeUrl;
      } else if (data.syncResult?.youtube?.youtubeUrl) {
        newUrls.youtube = data.syncResult.youtube.youtubeUrl;
      } else if (data.platformUrls?.youtube) {
        newUrls.youtube = data.platformUrls.youtube;
      } else if (data.syncResult?.youtube?.playlistUrl) {
        newUrls.youtube = data.syncResult.youtube.playlistUrl;
      }
      
      // Fallback to the existing IDs if we didn't get URLs from the response
      if (!newUrls.spotify && spotifyId) {
        newUrls.spotify = `https://open.spotify.com/playlist/${spotifyId}`;
      }
      
      if (!newUrls.youtube && youtubeId) {
        newUrls.youtube = `https://www.youtube.com/playlist?list/${youtubeId}`;
      }
      
      // Log detailed information about the sync response and platform URLs
      console.log("Sync Response Data:", {
        "data.spotifyUrl": data.spotifyUrl,
        "data.youtubeUrl": data.youtubeUrl,
        "data.platformUrls": data.platformUrls,
        "data.syncResult": data.syncResult,
        "spotifyId": spotifyId,
        "youtubeId": youtubeId,
        "newUrls": newUrls,
        "platformUrls": platformUrls
      });
      
      // Log the platform URLs for debugging
      console.log("Platform URLs after sync:", newUrls);
      
      setPlatformUrls(newUrls);
      
      // If any platforms were created, update the connected status
      if (data.syncResult?.spotify?.created || data.syncResult?.youtube?.created) {
        setTimeout(() => {
          window.location.reload(); // Reload the page to update the UI with new connection status
        }, 2000);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setIsSyncing(false);
    }
  };

  // Check if synchronization is possible
  const canSync = spotifyConnected && youtubeConnected;
  
  // Count connected platforms
  const connectedPlatforms = [
    spotifyConnected && 'Spotify',
    youtubeConnected && 'YouTube Music'
  ].filter(Boolean);

  return (
    <div className="font-mono text-green-400 bg-black p-4 rounded border border-green-500 shadow-lg shadow-green-500/20 relative overflow-hidden">
      {/* CRT scan lines effect */}
      <div className="absolute inset-0 pointer-events-none bg-scan-lines opacity-10"></div>
      
      <h3 className="text-xl mb-4 font-bold tracking-wide">
        <span className="inline-block w-3 h-3 bg-green-500 mr-2 animate-pulse"></span>
        SYNC STATUS
      </h3>
      
      <div className="grid grid-cols-1 gap-2 mb-4">
        <div className="flex justify-between">
          <span>CONNECTED PLATFORMS:</span>
          <span className={connectedPlatforms.length < 2 ? 'text-red-500' : ''}>
            {connectedPlatforms.length === 0 
              ? 'NONE' 
              : connectedPlatforms.join(', ')}
          </span>
        </div>
        
        <div className="flex justify-between">
          <span>LAST SYNCED:</span>
          <span>{formatDate(lastSyncedAt)}</span>
        </div>
        
        <div className="flex justify-between">
          <span>SYNC STATUS:</span>
          <span className={canSync ? 'text-green-500' : 'text-red-500'}>
            {canSync ? 'READY' : 'UNAVAILABLE'}
          </span>
        </div>
        
        {/* Platform links - ALWAYS show if IDs exist */}
        {(!!spotifyId || !!youtubeId || platformUrls.spotify || platformUrls.youtube) && (
          <div className="mt-2 border-t border-green-500 pt-2">
            <div className="text-green-500 mb-2">PLATFORM LINKS:</div>
            <div className="flex flex-col gap-2">
              {(platformUrls.spotify || spotifyId) && (
                <a 
                  href={platformUrls.spotify || `https://open.spotify.com/playlist/${spotifyId}`} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center text-green-400 hover:text-green-300 transition-colors"
                >
                  <span className="inline-block w-2 h-2 bg-green-500 mr-2"></span>
                  OPEN IN SPOTIFY
                </a>
              )}
              {(platformUrls.youtube || youtubeId) && (
                <a 
                  href={platformUrls.youtube || `https://www.youtube.com/playlist?list/${youtubeId}`} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center text-green-400 hover:text-green-300 transition-colors"
                >
                  <span className="inline-block w-2 h-2 bg-green-500 mr-2"></span>
                  OPEN IN YOUTUBE
                </a>
              )}
            </div>
          </div>
        )}
      </div>
      
      {!canSync && (
        <div className="text-yellow-500 mb-4 p-2 border border-yellow-500 bg-black">
          <p>CONNECT BOTH PLATFORMS TO ENABLE SYNC</p>
        </div>
      )}
      
      {error && (
        <div className="text-red-500 mb-4 p-2 border border-red-500 bg-black">
          <p>ERROR: {error}</p>
        </div>
      )}
      
      {syncResult && (
        <div className="mb-4 p-2 border border-green-500 bg-black">
          <p className={syncResult.success ? 'text-green-500' : 'text-yellow-500'}>
            {syncResult.success ? (
              // Customized success message based on which platforms were synced
              <>
                {syncResult.platforms?.spotify && syncResult.platforms?.youtube
                  ? 'Spotify & YouTube sync success! Synchronized with both platforms'
                  : syncResult.platforms?.spotify
                  ? 'Spotify sync success! Synchronized with Spotify successfully'
                  : syncResult.platforms?.youtube
                  ? 'YouTube sync success! Synchronized with YouTube successfully'
                  : syncResult.message || 'Sync completed'}
              </>
            ) : (
              syncResult.message || 'Sync completed with warnings'
            )}
          </p>
          
          {/* Prominent platform links after successful sync */}
          {syncResult.success && (
            <div className="flex flex-wrap gap-2 mt-3">
              {/* Show Spotify link if connected or if spotifyId exists */}
              {(platformUrls.spotify || spotifyId) && (
                <a
                  href={platformUrls.spotify || `https://open.spotify.com/playlist/${spotifyId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center bg-green-900 bg-opacity-30 hover:bg-opacity-50 border border-green-500 px-3 py-1 text-green-400 hover:text-green-300 transition-colors"
                >
                  <span className="mr-2">🎵</span>
                  OPEN IN SPOTIFY
                </a>
              )}
              
              {/* Show YouTube link if connected or if youtubeId exists */}
              {(platformUrls.youtube || youtubeId) && (
                <a
                  href={platformUrls.youtube || `https://www.youtube.com/playlist?list=${youtubeId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center bg-green-900 bg-opacity-30 hover:bg-opacity-50 border border-green-500 px-3 py-1 text-green-400 hover:text-green-300 transition-colors"
                >
                  <span className="mr-2">▶️</span>
                  OPEN IN YOUTUBE
                </a>
              )}
            </div>
          )}
          
          {/* Clear display of which platforms were successfully synced */}
          <div className="mt-2 flex flex-col gap-1">
            {syncResult.platforms?.spotify && (
              <div className="text-green-500 flex items-center">
                <span className="inline-block w-2 h-2 bg-green-500 mr-2"></span>
                Successfully synced with Spotify
                {platformUrls.spotify && (
                  <a 
                    href={platformUrls.spotify} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="ml-2 underline text-green-400 hover:text-green-300"
                  >
                    View playlist
                  </a>
                )}
              </div>
            )}
            
            {syncResult.platforms?.youtube && (
              <div className="text-green-500 flex items-center">
                <span className="inline-block w-2 h-2 bg-green-500 mr-2"></span>
                Successfully synced with YouTube
                {platformUrls.youtube && (
                  <a 
                    href={platformUrls.youtube} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="ml-2 underline text-green-400 hover:text-green-300"
                  >
                    View playlist
                  </a>
                )}
              </div>
            )}
          </div>
          
          {/* Display information about created playlists */}
          {(syncResult.syncResult?.spotify?.created || syncResult.syncResult?.youtube?.created) && (
            <div className="mt-2 text-green-500">
              {syncResult.syncResult?.spotify?.created && (
                <p>✓ Created new Spotify playlist</p>
              )}
              {syncResult.syncResult?.youtube?.created && (
                <p>✓ Created new YouTube playlist</p>
              )}
            </div>
          )}
          
          {/* Detailed sync results if available */}
          {(syncResult.syncResult?.spotify || syncResult.syncResult?.youtube) && (
            <div className="mt-2 text-xs border-t border-green-500 pt-2">
              <div className="font-bold text-green-400 mb-1">Sync Details:</div>
              
              {syncResult.syncResult?.spotify && (
                <div className="mb-1">
                  <span className="text-green-400">Spotify: </span>
                  <span className={syncResult.syncResult.spotify.success ? 'text-green-500' : 'text-red-500'}>
                    {syncResult.syncResult.spotify.success 
                      ? `${syncResult.syncResult.spotify.created ? 'Created new playlist, ' : ''}${syncResult.syncResult.spotify.added || 0} tracks added` 
                      : syncResult.syncResult.spotify.message || 'Failed to sync'}
                  </span>
                </div>
              )}
              
              {syncResult.syncResult?.youtube && (
                <div className="mb-1">
                  <span className="text-green-400">YouTube: </span>
                  <span className={syncResult.syncResult.youtube.success ? 'text-green-500' : 'text-red-500'}>
                    {syncResult.syncResult.youtube.success 
                      ? `${syncResult.syncResult.youtube.created ? 'Created new playlist, ' : ''}${syncResult.syncResult.youtube.added || 0} tracks added` 
                      : syncResult.syncResult.youtube.message || 'Failed to sync'}
                  </span>
                </div>
              )}
            </div>
          )}
          
          {/* Legacy display for older response format */}
          {syncResult.results && (
            <div className="mt-2 text-xs">
              {Object.entries(syncResult.results).map(([key, result]: [string, any]) => (
                <div key={key} className="mb-1">
                  <span>{key}: </span>
                  <span className={result.success ? 'text-green-500' : 'text-red-500'}>
                    {result.success 
                      ? `${result.created ? 'Created new playlist, ' : ''}${result.added || 0} added, ${result.updated || 0} matched` 
                      : result.error || result.message}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      
      <button
        onClick={handleSync}
        disabled={!canSync || isSyncing}
        className={`w-full p-2 border ${
          canSync 
            ? 'border-green-500 hover:bg-green-900 hover:bg-opacity-30' 
            : 'border-gray-500 opacity-50 cursor-not-allowed'
        } transition-colors duration-200 uppercase tracking-wider font-bold`}
      >
        {isSyncing ? (
          <span className="flex items-center justify-center">
            <span className="animate-pulse mr-2">■</span>
            SYNCING...
          </span>
        ) : (
          'SYNCHRONIZE PLAYLIST'
        )}
      </button>
    </div>
  );
} 