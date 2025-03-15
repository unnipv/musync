'use client';

import Link from 'next/link';
import { useState } from 'react';

interface PlatformData {
  provider: string;
  id: string;
  url: string;
  synced: boolean;
}

interface PlaylistCardProps {
  playlist: {
    _id: string;
    name: string;
    description: string;
    tracks: any[];
    platformData: PlatformData[];
    isPublic: boolean;
  };
}

/**
 * Component to display a playlist in a card format
 * 
 * @param playlist - The playlist data to display
 * @returns A card component displaying the playlist
 */
export default function PlaylistCard({ playlist }: PlaylistCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  
  // Determine which platforms this playlist is on
  const platforms = playlist.platformData.map(p => p.provider);
  const hasPlatforms = platforms.length > 0;
  const isSpotify = platforms.includes('spotify');
  const isYouTube = platforms.includes('youtube');
  
  // Determine if the playlist is synced across platforms
  const isSynced = playlist.platformData.length > 1 && 
    playlist.platformData.every(p => p.synced);
  
  return (
    <Link 
      href={`/playlists/${playlist._id}`}
      className="block"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className={`border ${isHovered ? 'border-phosphor-light' : 'border-phosphor'} p-4 transition-colors`}>
        <div className="w-full h-40 bg-phosphor-dark mb-4 flex items-center justify-center">
          {/* Placeholder for playlist cover image */}
          <span className="font-pixel text-phosphor">{playlist.name}</span>
        </div>
        
        <h3 className="font-retro text-xl mb-2 phosphor-text truncate">
          {playlist.name}
        </h3>
        
        <p className="font-retro text-sm mb-2">
          {playlist.tracks.length} tracks
        </p>
        
        <div className="flex flex-wrap gap-2">
          {hasPlatforms && (
            <>
              {isSpotify && (
                <span className="px-2 py-1 bg-phosphor-dark text-phosphor text-xs font-retro">
                  SPOTIFY
                </span>
              )}
              
              {isYouTube && (
                <span className="px-2 py-1 bg-phosphor-dark text-phosphor text-xs font-retro">
                  YOUTUBE
                </span>
              )}
            </>
          )}
          
          {isSynced && (
            <span className="px-2 py-1 bg-phosphor-dark text-phosphor text-xs font-retro">
              SYNCED
            </span>
          )}
          
          {!playlist.isPublic && (
            <span className="px-2 py-1 bg-phosphor-dark text-phosphor text-xs font-retro">
              PRIVATE
            </span>
          )}
        </div>
      </div>
    </Link>
  );
} 