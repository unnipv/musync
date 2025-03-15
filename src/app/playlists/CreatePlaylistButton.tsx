'use client';

import { useRouter } from 'next/navigation';

/**
 * Button component for creating a new playlist
 * When clicked, it navigates to the create playlist page
 * 
 * @returns A button component for creating a new playlist
 */
export default function CreatePlaylistButton() {
  const router = useRouter();
  
  /**
   * Handles the button click event
   * Navigates to the create playlist page
   */
  const handleClick = () => {
    router.push('/playlists/create');
  };
  
  return (
    <button 
      onClick={handleClick} 
      className="pixel-button"
    >
      + NEW PLAYLIST
    </button>
  );
} 