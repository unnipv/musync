import 'next-auth';
import { JWT } from 'next-auth/jwt';

declare module 'next-auth' {
  /**
   * Extends the built-in session types
   */
  interface Session {
    accessToken?: string;
    error?: string;
    provider?: string;
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }

  /**
   * Extends the built-in user types
   */
  interface User {
    id: string;
    name?: string | null;
    email?: string | null;
    image?: string | null;
  }

  interface Profile {
    id?: string;
    display_name?: string;
    email?: string;
    images?: { url: string }[];
  }
}

declare module 'next-auth/jwt' {
  /**
   * Extends the built-in JWT types
   */
  interface JWT {
    accessToken?: string;
    refreshToken?: string;
    accessTokenExpires?: number;
    error?: string;
    provider?: string;
    userId?: string;
    id?: string;
  }
} 