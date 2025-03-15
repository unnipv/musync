import { getServerSession } from 'next-auth/next';
import { notFound, redirect } from 'next/navigation';
import { ObjectId } from 'mongodb';
import authOptions from '@/lib/auth';
import dbConnect from '@/lib/mongoose';
import Playlist, { PlaylistSchema, PlaylistDocument } from '@/lib/models/playlist';
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
async function getPlaylist(id: string, userId: string): Promise<PlaylistDocument | null> {
  if (!ObjectId.isValid(id)) {
    return null;
  }
  
  await dbConnect();
  
  // Use type assertion for lean document
  const playlist = await Playlist.findById(id).lean() as any;
  
  if (!playlist) {
    return null;
  }
  
  // Check if the user owns the playlist or if it's public
  if (playlist.userId.toString() !== userId && !playlist.isPublic) {
    return null;
  }
  
  // Convert Mongoose document to plain object and ensure proper typing
  return {
    ...playlist,
    _id: playlist._id.toString(),
    userId: playlist.userId.toString(),
    tracks: playlist.tracks || [],
    platformData: playlist.platformData || [],
    createdAt: playlist.createdAt instanceof Date ? playlist.createdAt.toISOString() : playlist.createdAt,
    updatedAt: playlist.updatedAt instanceof Date ? playlist.updatedAt.toISOString() : playlist.updatedAt
  };
}

/**
 * Playlist detail page component
 */
export default async function PlaylistPage({ params }: PlaylistPageProps) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  
  if (!userId) {
    redirect('/login');
  }
  
  const playlist = await getPlaylist(params.id, userId);
  
  if (!playlist) {
    notFound();
  }
  
  const isOwner = playlist.userId === userId;
  
  return (
    <main className="container mx-auto px-4 py-8">
      <PlaylistDetail playlist={playlist} isOwner={isOwner} />
    </main>
  );
} 