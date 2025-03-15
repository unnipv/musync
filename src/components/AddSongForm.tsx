'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Component for adding a new song to a playlist
 * 
 * @param props - Component props containing the playlist ID
 * @returns The add song form component
 */
export default function AddSongForm({ playlistId }: { playlistId: string }) {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [album, setAlbum] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  /**
   * Handles form submission to add a new song
   * 
   * @param e - Form submit event
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title || !artist) {
      alert('Title and artist are required');
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      const response = await fetch(`/api/playlists/${playlistId}/songs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title,
          artist,
          album,
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to add song');
      }
      
      // Reset form
      setTitle('');
      setArtist('');
      setAlbum('');
      
      // Refresh the page to show the new song
      router.refresh();
    } catch (error) {
      console.error('Error adding song:', error);
      alert('Failed to add song. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="title" className="block text-green-500 mb-1">
          Title
        </label>
        <input
          type="text"
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full bg-black border border-green-500 text-green-400 p-2 rounded-md focus:outline-none focus:ring-1 focus:ring-green-500"
          required
        />
      </div>
      
      <div>
        <label htmlFor="artist" className="block text-green-500 mb-1">
          Artist
        </label>
        <input
          type="text"
          id="artist"
          value={artist}
          onChange={(e) => setArtist(e.target.value)}
          className="w-full bg-black border border-green-500 text-green-400 p-2 rounded-md focus:outline-none focus:ring-1 focus:ring-green-500"
          required
        />
      </div>
      
      <div>
        <label htmlFor="album" className="block text-green-500 mb-1">
          Album (Optional)
        </label>
        <input
          type="text"
          id="album"
          value={album}
          onChange={(e) => setAlbum(e.target.value)}
          className="w-full bg-black border border-green-500 text-green-400 p-2 rounded-md focus:outline-none focus:ring-1 focus:ring-green-500"
        />
      </div>
      
      <button
        type="submit"
        disabled={isSubmitting}
        className="bg-green-600 hover:bg-green-500 text-black px-4 py-2 rounded-md transition-colors disabled:opacity-50"
      >
        {isSubmitting ? 'Adding...' : 'Add Song'}
      </button>
    </form>
  );
} 