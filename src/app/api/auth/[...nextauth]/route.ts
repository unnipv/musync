import NextAuth from 'next-auth';
import { authOptions } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * NextAuth.js API route handler
 * This route handles all authentication requests
 */
const handler = NextAuth(authOptions);

export { handler as GET, handler as POST }; 