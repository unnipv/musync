import { getServerSession } from 'next-auth/next';
import { redirect } from 'next/navigation';
import authOptions from '@/lib/auth';
import PlaylistForm from '@/components/PlaylistForm';

/**
 * Page component for creating a new playlist
 * 
 * @returns The create playlist page component
 */
export default async function CreatePlaylistPage() {
  // Check if user is authenticated
  const session = await getServerSession(authOptions);
  
  if (!session) {
    redirect('/login?callbackUrl=/playlists/create');
  }
  
  return (
    <main className="container mx-auto px-4 py-8">
      <h1 className="text-4xl font-pixel phosphor-text mb-8">CREATE PLAYLIST</h1>
      
      <PlaylistForm mode="create" />
    </main>
  );
} 