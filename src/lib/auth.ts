import { NextAuthOptions } from 'next-auth';
import SpotifyProvider from 'next-auth/providers/spotify';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import dbConnect from './mongoose';
import User from './models/user';
import { JWT } from "next-auth/jwt";

/**
 * Refreshes a Spotify access token
 * 
 * @param token - The current JWT token
 * @returns The updated token with refreshed access token
 */
async function refreshAccessToken(token: JWT) {
  try {
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
      throw refreshedTokens;
    }

    return {
      ...token,
      accessToken: refreshedTokens.access_token,
      accessTokenExpires: Date.now() + refreshedTokens.expires_in * 1000,
      refreshToken: refreshedTokens.refresh_token ?? token.refreshToken, // Fall back to old refresh token
    };
  } catch (error) {
    console.error("Error refreshing access token", error);
    return {
      ...token,
      error: "RefreshAccessTokenError",
    };
  }
}

/**
 * Configuration options for NextAuth
 */
const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }
        
        await dbConnect();
        
        const user = await User.findOne({ email: credentials.email });
        
        if (!user) {
          return null;
        }
        
        const isPasswordValid = await bcrypt.compare(
          credentials.password,
          user.password
        );
        
        if (!isPasswordValid) {
          return null;
        }
        
        return {
          id: user._id.toString(),
          email: user.email,
          name: user.name,
          image: user.image
        };
      }
    }),
    SpotifyProvider({
      clientId: process.env.SPOTIFY_CLIENT_ID || '',
      clientSecret: process.env.SPOTIFY_CLIENT_SECRET || '',
      authorization: {
        params: {
          scope: 'user-read-email playlist-modify-private playlist-read-private playlist-modify-public'
        }
      }
    })
  ],
  callbacks: {
    async jwt({ token, account, user }) {
      // Initial sign in
      if (account && user) {
        // Connect to database
        await dbConnect();
        
        // Check if user exists in database
        let dbUser = await User.findOne({ email: user.email });
        
        // Create user if not exists
        if (!dbUser) {
          dbUser = await User.create({
            name: user.name,
            email: user.email,
            image: user.image,
            platforms: [],
          });
        }
        
        // Update user's platform connection if this is a Spotify login
        if (account.provider === "spotify") {
          // Find if Spotify is already in platforms array
          const spotifyIndex = dbUser.platforms.findIndex(
            (p: any) => p.name === "spotify"
          );
          
          const platformData = {
            name: "spotify",
            userId: account.providerAccountId,
            lastSyncedAt: null,
          };
          
          if (spotifyIndex >= 0) {
            // Update existing platform data
            dbUser.platforms[spotifyIndex] = platformData;
          } else {
            // Add new platform
            dbUser.platforms.push(platformData);
          }
          
          await dbUser.save();
        }
        
        return {
          ...token,
          accessToken: account.access_token,
          refreshToken: account.refresh_token,
          accessTokenExpires: account.expires_at ? account.expires_at * 1000 : 0,
          userId: dbUser._id.toString(),
        };
      }
      
      // Return previous token if the access token has not expired yet
      if (token.accessTokenExpires && Date.now() < token.accessTokenExpires) {
        return token;
      }
      
      // Access token has expired, try to refresh it
      if (token.refreshToken) {
        return refreshAccessToken(token);
      }
      
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.accessToken = token.accessToken as string;
        session.error = token.error as string;
        session.userId = token.userId as string;
      }
      
      return session;
    },
    async signIn({ user, account, profile }) {
      // For OAuth sign-ins, create or update the user in the database
      if (account?.provider === 'spotify' && profile) {
        try {
          await dbConnect();
          
          // Check if user exists
          const existingUser = await User.findOne({ email: profile.email });
          
          if (existingUser) {
            // Update user with latest profile info
            existingUser.name = profile.name || existingUser.name;
            existingUser.image = profile.image || profile.picture || existingUser.image;
            existingUser.spotifyId = profile.id;
            await existingUser.save();
          } else {
            // Create new user
            await User.create({
              email: profile.email,
              name: profile.name,
              image: profile.image || profile.picture,
              spotifyId: profile.id
            });
          }
          
          return true;
        } catch (error) {
          console.error('Error during sign in:', error);
          return false;
        }
      }
      
      return true;
    }
  },
  pages: {
    signIn: '/login',
    signOut: '/',
    error: '/login',
    newUser: '/profile'
  },
  session: {
    strategy: 'jwt'
  },
  secret: process.env.NEXTAUTH_SECRET
};

export default authOptions; 