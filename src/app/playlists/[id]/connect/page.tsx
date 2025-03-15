import { getServerSession } from 'next-auth/next';
import { redirect } from 'next/navigation';
import { ObjectId } from 'mongodb';
import authOptions from '@/lib/auth';
import dbConnect from '@/lib/mongoose';
import Playlist from '@/lib/models/playlist';
import ConnectPlatformsForm from '@/components/ConnectPlatformsForm';

/**
 * Page for connecting streaming platforms to a playlist
 * 
 * @param props - Page props containing the playlist ID
 * @returns The connect platforms page component
 */
export default async function ConnectPlatformsPage({ 
  params 
}: { 
  params: { id: string } 
}) {
  const session = await getServerSession(authOptions);
  
  if (!session || !session.user) {
    redirect('/login');
  }
  
  if (!ObjectId.isValid(params.id)) {
    redirect('/playlists');
  }
  
  await dbConnect();
  
  // Find the playlist and ensure it belongs to the current user
  const playlist = await Playlist.findOne({
    _id: params.id,
    userId: session.user.id
  }).lean();
  
  if (!playlist) {
    redirect('/playlists');
  }
  
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-green-500 mb-6">
        Connect Platforms to Playlist
      </h1>
      
      <div className="bg-black p-6 rounded-lg border border-green-500 shadow-lg">
        <h2 className="text-2xl font-bold text-green-500 mb-4">
          {playlist.name || playlist.title}
        </h2>
        
        <p className="text-green-400 mb-6">
          Connect your streaming platforms to enable synchronization of this playlist.
        </p>
        
        <ConnectPlatformsForm 
          playlistId={params.id} 
          existingConnections={playlist.platformData || []}
        />
      </div>
    </div>
  );
} 