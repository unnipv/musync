import { getServerSession } from 'next-auth/next';
import { notFound, redirect } from 'next/navigation';
import { ObjectId } from 'mongodb';
import authOptions from '@/lib/auth';
import dbConnect from '@/lib/mongoose';
import Playlist from '@/lib/models/playlist';
import PlaylistDetail from '@/components/PlaylistDetail';

interface PlaylistPageProps {
  params: {
    id: string;
  };
}

/**
 * Fetches a playlist by ID with all song data
 * 
 * @param id - The playlist ID
 * @param userId - The user ID
 * @returns The playlist or null if not found
 */
async function getPlaylist(id: string, userId: string) {
  if (!ObjectId.isValid(id)) {
    return null;
  }
  
  await dbConnect();
  
  // Use populate to ensure all song data is included
  const playlist = await Playlist.findById(id)
    .lean() // Use lean for better performance
    .exec();
  
  if (!playlist) {
    return null;
  }
  
  // Check if the user owns the playlist or if it's public
  if (playlist.userId.toString() !== userId && !playlist.isPublic) {
    return null;
  }
  
  console.log('Fetched playlist data:', JSON.stringify(playlist, null, 2));
  
  return JSON.parse(JSON.stringify(playlist));
}

/**
 * Playlist detail page component
 * 
 * @param params - The route parameters containing the playlist ID
 * @returns The playlist detail page
 */
export default async function PlaylistPage({ params }: PlaylistPageProps) {
  const session = await getServerSession(authOptions);
  
  if (!session || !session.user) {
    redirect('/login');
  }
  
  const playlist = await getPlaylist(params.id, session.user.id);
  
  if (!playlist) {
    notFound();
  }
  
  const isOwner = playlist.userId.toString() === session.user.id;
  
  return (
    <main className="container mx-auto px-4 py-8">
      <PlaylistDetail playlist={playlist} isOwner={isOwner} />
    </main>
  );
} 