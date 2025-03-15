import { getServerSession } from 'next-auth/next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ObjectId } from 'mongodb';
import authOptions from '@/lib/auth';
import dbConnect from '@/lib/mongoose';
import Playlist from '@/lib/models/playlist';
import CreatePlaylistButton from '@/components/CreatePlaylistButton';
import ImportPlaylistsButton from '@/components/ImportPlaylistsButton';

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

/**
 * Fetches all playlists for a user
 * @param userId - The user's ID
 * @returns Array of playlists
 */
async function getUserPlaylists(userId: string): Promise<PlaylistDocument[]> {
  await dbConnect();
  const playlists = await Playlist.find({ userId }).lean() as PlaylistDocument[];
  return playlists;
}

/**
 * Playlists page component
 * 
 * @returns The playlists page
 */
export default async function PlaylistsPage() {
  const session = await getServerSession(authOptions);
  
  if (!session || !session.user) {
    redirect('/login');
  }
  
  const playlists = await getUserPlaylists(session.user.id);
  
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-green-500 font-vt323 crt-text">Your Playlists</h1>
        <div className="flex space-x-4">
          <ImportPlaylistsButton />
          <CreatePlaylistButton />
        </div>
      </div>
      
      {playlists.length === 0 ? (
        <div className="bg-black p-6 rounded-lg border-2 border-green-500 shadow-[0_0_15px_#00ff00] text-center crt-panel">
          <p className="text-green-400 mb-4 font-vt323">You don&apos;t have any playlists yet.</p>
          <p className="text-green-400 font-vt323">
            Create your first playlist or import from a connected platform.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {playlists.map((playlist) => (
            <Link
              key={playlist._id.toString()}
              href={`/playlists/${playlist._id.toString()}`}
              className="bg-black p-6 rounded-lg border-2 border-green-500 shadow-[0_0_10px_#00ff00] hover:shadow-[0_0_15px_#00ff00] hover:border-green-400 transition-all crt-card"
            >
              <h2 className="text-xl font-bold text-green-500 mb-2 font-vt323 crt-text">
                {playlist.name || playlist.title || 'Untitled Playlist'}
              </h2>
              <p className="text-green-400 mb-4 line-clamp-2 font-vt323">
                {playlist.description || 'No description'}
              </p>
              <div className="flex justify-between items-center">
                <span className="text-sm text-green-600 font-vt323">
                  {playlist.tracks.length} {playlist.tracks.length === 1 ? 'track' : 'tracks'}
                </span>
                <span className="text-sm text-green-600 font-vt323">
                  {new Date(playlist.updatedAt).toLocaleDateString()}
                </span>
              </div>
              {playlist.isPublic && (
                <span className="inline-block bg-green-500 text-black text-sm px-2 py-1 rounded mt-2">
                  Public
                </span>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
} 