import { getServerSession } from 'next-auth/next';
import { redirect, notFound } from 'next/navigation';
import { ObjectId } from 'mongodb';
import authOptions from '@/lib/auth';
import dbConnect from '@/lib/mongoose';
import Playlist from '@/lib/models/playlist';
import ConnectPlatformsForm from '@/components/ConnectPlatformsForm';

/**
 * Interface for playlist document from MongoDB
 */
interface PlaylistDocument {
  _id: ObjectId;
  userId: ObjectId;
  name?: string;
  title?: string;
  description?: string;
  isPublic?: boolean;
  tracks: any[];
  platformData?: any[];
  createdAt: Date;
  updatedAt: Date;
}

interface ConnectPageProps {
  params: {
    id: string;
  };
}

/**
 * Fetches a playlist by ID
 * @param id - The playlist ID
 * @param userId - The user ID
 * @returns The playlist or null if not found
 */
async function getPlaylist(id: string, userId: string): Promise<PlaylistDocument | null> {
  if (!ObjectId.isValid(id)) {
    return null;
  }
  
  await dbConnect();
  
  const playlist = await Playlist.findOne({
    _id: id,
    userId
  }).lean() as PlaylistDocument | null;
  
  return playlist;
}

/**
 * Page for connecting streaming platforms to a playlist
 */
export default async function ConnectPlatformsPage({ params }: ConnectPageProps) {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.id) {
    redirect('/login');
  }
  
  const playlist = await getPlaylist(params.id, session.user.id);
  
  if (!playlist) {
    notFound();
  }
  
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-green-500 mb-6">
        Connect Platforms to Playlist
      </h1>
      
      <div className="bg-black p-6 rounded-lg border border-green-500 shadow-lg">
        <h2 className="text-2xl font-bold text-green-500 mb-4">
          {playlist.name || playlist.title || 'Untitled Playlist'}
        </h2>
        
        <p className="text-green-400 mb-6">
          Connect your streaming platforms to enable synchronization of this playlist.
        </p>
        
        <ConnectPlatformsForm 
          playlistId={playlist._id.toString()} 
          existingConnections={playlist.platformData || []}
        />
      </div>
    </div>
  );
} 