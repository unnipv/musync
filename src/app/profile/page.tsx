import { getServerSession } from 'next-auth/next';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import authOptions from '@/lib/auth';
import ProfileContent from '@/components/ProfileContent';

/**
 * Profile page component
 * 
 * @returns The profile page
 */
export default async function ProfilePage() {
  const session = await getServerSession(authOptions);
  
  if (!session || !session.user) {
    redirect('/login');
  }
  
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-green-500 font-vt323 mb-6 crt-text">PROFILE</h1>
      
      <ProfileContent userId={session.user.id || ''} />
      
      <div className="mt-6">
        <Link 
          href="/" 
          className="text-green-500 font-vt323 hover:text-green-400 transition-colors crt-text"
        >
          RETURN HOME
        </Link>
      </div>
    </div>
  );
} 