'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Button component for creating a new playlist
 * 
 * @returns The create playlist button component
 */
export default function CreatePlaylistButton() {
  const router = useRouter();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  
  /**
   * Opens the create playlist modal
   */
  const openModal = () => {
    setIsModalOpen(true);
  };
  
  /**
   * Closes the create playlist modal
   */
  const closeModal = () => {
    setIsModalOpen(false);
    setName('');
    setDescription('');
    setIsPublic(true);
    setError('');
  };
  
  /**
   * Handles the form submission to create a new playlist
   * 
   * @param e - The form submit event
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name) {
      setError('Playlist name is required');
      return;
    }
    
    setIsSubmitting(true);
    setError('');
    
    try {
      const response = await fetch('/api/playlists', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
          description,
          isPublic,
        }),
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create playlist');
      }
      
      const data = await response.json();
      
      closeModal();
      router.push(`/playlists/${data.playlist._id}`);
    } catch (error) {
      console.error('Error creating playlist:', error);
      setError(error instanceof Error ? error.message : 'Failed to create playlist');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  return (
    <>
      <button
        onClick={openModal}
        className="bg-green-600 hover:bg-green-500 text-black font-vt323 px-4 py-2 rounded-md transition-colors shadow-[0_0_10px_#00ff00] crt-glow"
      >
        Create Playlist
      </button>
      
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 crt-overlay">
          <div className="bg-black p-6 rounded-lg border-2 border-green-500 shadow-[0_0_15px_#00ff00] w-full max-w-md crt-panel">
            <h2 className="text-2xl font-bold text-green-500 font-vt323 mb-4 crt-text">Create New Playlist</h2>
            
            {error && (
              <div className="mb-4 p-3 bg-red-900/50 text-green-100 rounded border border-red-500 crt-error">
                {error}
              </div>
            )}
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="name" className="block text-green-500 font-vt323 mb-1">
                  Name
                </label>
                <input
                  type="text"
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-black border-2 border-green-500 text-green-400 p-2 rounded-md focus:outline-none focus:shadow-[0_0_10px_#00ff00] font-vt323 crt-input"
                  required
                />
              </div>
              
              <div>
                <label htmlFor="description" className="block text-green-500 font-vt323 mb-1">
                  Description (Optional)
                </label>
                <textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-black border-2 border-green-500 text-green-400 p-2 rounded-md focus:outline-none focus:shadow-[0_0_10px_#00ff00] font-vt323 crt-input"
                  rows={3}
                />
              </div>
              
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="isPublic"
                  checked={isPublic}
                  onChange={(e) => setIsPublic(e.target.checked)}
                  className="mr-2 h-4 w-4 text-green-600 focus:ring-green-500 border-green-500 rounded crt-checkbox"
                />
                <label htmlFor="isPublic" className="text-green-500 font-vt323">
                  Public playlist
                </label>
              </div>
              
              <div className="flex justify-end space-x-4 mt-6">
                <button
                  type="button"
                  onClick={closeModal}
                  className="bg-gray-800 hover:bg-gray-700 text-green-500 font-vt323 px-4 py-2 rounded-md transition-colors border border-green-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-green-600 hover:bg-green-500 text-black font-vt323 px-4 py-2 rounded-md transition-colors disabled:opacity-50 shadow-[0_0_10px_#00ff00] crt-glow"
                >
                  {isSubmitting ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
} 