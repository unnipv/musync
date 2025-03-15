import React, { useState } from 'react';
import { useSession } from 'next-auth/react';

interface SyncStatusProps {
  playlistId: string;
  spotifyConnected: boolean;
  youtubeConnected: boolean;
  lastSyncedAt?: Date | null;
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
  lastSyncedAt
}: SyncStatusProps) {
  const { data: session } = useSession();
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

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
      const response = await fetch('/api/playlists/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ playlistId })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to synchronize playlist');
      }
      
      setSyncResult(data);
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
            {syncResult.message}
          </p>
          {syncResult.results && (
            <div className="mt-2 text-xs">
              {Object.entries(syncResult.results).map(([key, result]: [string, any]) => (
                <div key={key} className="mb-1">
                  <span>{key}: </span>
                  <span className={result.success ? 'text-green-500' : 'text-red-500'}>
                    {result.success 
                      ? `${result.added || 0} added, ${result.updated || 0} matched` 
                      : result.error}
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