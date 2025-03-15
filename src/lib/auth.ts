import { NextAuthOptions } from 'next-auth';
import SpotifyProvider from 'next-auth/providers/spotify';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { JWT } from "next-auth/jwt";
import GoogleProvider from "next-auth/providers/google";
import { connectToDatabase } from './mongodb';
import { compare } from 'bcryptjs';
import { ObjectId } from 'mongodb';

/**
 * Refreshes a Spotify access token
 * 
 * @param token - The current JWT token
 * @returns The updated token with refreshed access token
 */
async function refreshSpotifyAccessToken(token: JWT) {
  try {
    console.log("Refreshing Spotify access token for token:", {
      hasRefreshToken: !!token.refreshToken,
      userId: token.userId,
    });

    const url =
      "https://accounts.spotify.com/api/token?" +
      new URLSearchParams({
        client_id: process.env.SPOTIFY_CLIENT_ID || "",
        client_secret: process.env.SPOTIFY_CLIENT_SECRET || "",
        grant_type: "refresh_token",
        refresh_token: token.refreshToken as string,
      });

    const response = await fetch(url, {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      method: "POST",
    });

    const refreshedTokens = await response.json();

    if (!response.ok) {
      console.error("Error response from refresh token:", refreshedTokens);
      throw refreshedTokens;
    }

    console.log("Successfully refreshed Spotify token");

    return {
      ...token,
      accessToken: refreshedTokens.access_token,
      accessTokenExpires: Date.now() + refreshedTokens.expires_in * 1000,
      refreshToken: refreshedTokens.refresh_token ?? token.refreshToken, // Fall back to old refresh token
    };
  } catch (error) {
    console.error("Error refreshing Spotify access token", error);
    return {
      ...token,
      error: "RefreshAccessTokenError",
    };
  }
}

/**
 * Configuration options for NextAuth
 */
export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      id: 'credentials',
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Email and password required');
        }

        const { db } = await connectToDatabase();
        const user = await db.collection('users').findOne({ email: credentials.email });

        if (!user || !user.password) {
          throw new Error('No user found with this email');
        }

        const isPasswordValid = await compare(credentials.password, user.password);

        if (!isPasswordValid) {
          throw new Error('Invalid password');
        }

        return {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          image: user.image
        };
      }
    }),
    SpotifyProvider({
      clientId: process.env.SPOTIFY_CLIENT_ID || '',
      clientSecret: process.env.SPOTIFY_CLIENT_SECRET || '',
      authorization: {
        params: {
          scope: 'user-read-email user-read-private playlist-read-private playlist-read-collaborative'
        }
      }
    }),
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
      authorization: {
        params: {
          scope: 'https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/youtube.readonly'
        }
      }
    })
  ],
  session: {
    strategy: 'jwt'
  },
  callbacks: {
    async jwt({ token, user, account }) {
      // Initial sign in
      if (account && user) {
        console.log('JWT callback - user:', {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image
        });
        
        // Store the provider that was used to sign in
        return {
          ...token,
          accessToken: account.access_token,
          refreshToken: account.refresh_token,
          accessTokenExpires: account.expires_at ? account.expires_at * 1000 : 0,
          id: user.id,
          userId: user.id,
          provider: account.provider // Store the provider
        };
      }

      // Return previous token if the access token has not expired yet
      if (token.accessTokenExpires && Date.now() < (token.accessTokenExpires as number)) {
        return token;
      }

      // Access token has expired, try to refresh it
      if (token.refreshToken) {
        console.log('Refreshing access token for token:', { 
          hasRefreshToken: !!token.refreshToken, 
          userId: token.userId,
          provider: token.provider
        });
        
        try {
          // For Spotify, use the refreshSpotifyAccessToken function
          if (token.provider === 'spotify') {
            return await refreshSpotifyAccessToken(token);
          }
          
          // For other providers, just log and return the token
          console.log(`Token refresh not implemented for provider: ${token.provider}`);
          return token;
        } catch (error) {
          console.error('Error refreshing access token', error);
          return { ...token, error: 'RefreshAccessTokenError' };
        }
      }

      return token;
    },
    async session({ session, token }) {
      console.log('Session callback:', { 
        hasAccessToken: !!token.accessToken, 
        hasUserId: !!token.userId,
        hasError: !!token.error,
        provider: token.provider
      });
      
      if (token) {
        session.accessToken = token.accessToken as string;
        session.error = token.error as string;
        session.provider = token.provider as string;
        
        if (token.userId) {
          session.user = {
            ...session.user,
            id: token.userId as string
          };
        }
      }
      
      console.log('Session callback - token:', token);
      console.log('Session callback - returning session:', session);
      
      return session;
    }
  },
  pages: {
    signIn: '/login',
    error: '/login'
  },
  debug: process.env.NODE_ENV === 'development'
}; 