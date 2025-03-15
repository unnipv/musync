'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';

interface PlaylistFormProps {
  initialData?: {
    id?: string;
    name: string;
    description: string;
    isPublic: boolean;
  };
  mode: 'create' | 'edit';
  onSuccess?: (playlist: any) => void;
}

/**
 * Form component for creating or editing playlists
 * 
 * @param initialData - Initial data for the form when editing
 * @param mode - Whether the form is for creating or editing a playlist
 * @param onSuccess - Callback function to call when the form is successfully submitted
 * @returns A form component for creating or editing playlists
 */
export default function PlaylistForm({ 
  initialData = { name: '', description: '', isPublic: true },
  mode = 'create',
  onSuccess
}: PlaylistFormProps) {
  const router = useRouter();
  const [formData, setFormData] = useState(initialData);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  /**
   * Handles form submission
   * 
   * @param e - The form event
   */
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const url = mode === 'create' 
        ? '/api/playlists' 
        : `/api/playlists/${initialData.id}`;
      
      const method = mode === 'create' ? 'POST' : 'PUT';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Something went wrong');
      }

      setSuccess(mode === 'create' 
        ? 'Playlist created successfully!' 
        : 'Playlist updated successfully!');
      
      if (onSuccess) {
        onSuccess(data.playlist);
      } else {
        // Redirect to the playlist page after a short delay
        setTimeout(() => {
          router.push(mode === 'create' 
            ? `/playlists/${data.playlist._id}` 
            : `/playlists/${initialData.id}`);
          router.refresh();
        }, 1500);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Handles input changes
   * 
   * @param e - The input change event
   */
  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target;
    
    setFormData({
      ...formData,
      [name]: type === 'checkbox' 
        ? (e.target as HTMLInputElement).checked 
        : value,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl mx-auto">
      {error && (
        <div className="bg-red-500 text-white p-4 rounded font-retro">
          {error}
        </div>
      )}
      
      {success && (
        <div className="bg-green-500 text-white p-4 rounded font-retro">
          {success}
        </div>
      )}
      
      <div className="space-y-2">
        <label htmlFor="name" className="block font-pixel phosphor-text">
          NAME
        </label>
        <input
          type="text"
          id="name"
          name="name"
          value={formData.name}
          onChange={handleChange}
          required
          className="w-full p-2 border border-phosphor bg-black text-phosphor font-retro focus:border-phosphor-light focus:outline-none"
        />
      </div>
      
      <div className="space-y-2">
        <label htmlFor="description" className="block font-pixel phosphor-text">
          DESCRIPTION
        </label>
        <textarea
          id="description"
          name="description"
          value={formData.description}
          onChange={handleChange}
          rows={4}
          className="w-full p-2 border border-phosphor bg-black text-phosphor font-retro focus:border-phosphor-light focus:outline-none"
        />
      </div>
      
      <div className="flex items-center space-x-2">
        <input
          type="checkbox"
          id="isPublic"
          name="isPublic"
          checked={formData.isPublic}
          onChange={handleChange as any}
          className="border border-phosphor bg-black text-phosphor"
        />
        <label htmlFor="isPublic" className="font-pixel phosphor-text">
          PUBLIC
        </label>
      </div>
      
      <button
        type="submit"
        disabled={isLoading}
        className="pixel-button w-full"
      >
        {isLoading 
          ? 'PROCESSING...' 
          : mode === 'create' 
            ? 'CREATE PLAYLIST' 
            : 'UPDATE PLAYLIST'}
      </button>
    </form>
  );
} 