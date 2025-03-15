import 'next-auth';
import { JWT } from 'next-auth/jwt';
import { DefaultSession } from "next-auth";

declare module 'next-auth' {
  /**
   * Extends the built-in session types
   */
  interface Session {
    user: {
      /** The user's id */
      id: string;
      /** The user's name */
      name?: string | null;
      /** The user's email address */
      email?: string | null;
      /** The user's image */
      image?: string | null;
      /** Spotify access token */
      spotifyAccessToken?: string;
      /** Google access token */
      googleAccessToken?: string;
    } & DefaultSession["user"];
    /** The access token */
    accessToken?: string;
    /** The provider (spotify, google, etc.) */
    provider?: string;
    /** Any error that occurred during authentication */
    error?: string;
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