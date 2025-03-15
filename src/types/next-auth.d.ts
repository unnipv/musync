import NextAuth, { DefaultSession } from "next-auth";
import { JWT } from "next-auth/jwt";

declare module "next-auth" {
  /**
   * Extends the built-in session types
   */
  interface Session {
    user: {
      /** The user's name */
      name?: string | null;
      /** The user's email address */
      email?: string | null;
      /** The user's profile image */
      image?: string | null;
    } & DefaultSession["user"];
    /** The user's Spotify access token */
    accessToken?: string;
    /** Any error that occurred during token refresh */
    error?: string;
    /** The user's database ID */
    userId?: string;
  }

  /**
   * Extends the built-in user types
   */
  interface User {
    id?: string;
    _id?: string;
  }
}

declare module "next-auth/jwt" {
  /**
   * Extends the built-in JWT types
   */
  interface JWT {
    /** The user's Spotify access token */
    accessToken?: string;
    /** The user's Spotify refresh token */
    refreshToken?: string;
    /** When the access token expires */
    accessTokenExpires?: number;
    /** Any error that occurred during token refresh */
    error?: string;
    /** The user's database ID */
    userId?: string;
  }
} 