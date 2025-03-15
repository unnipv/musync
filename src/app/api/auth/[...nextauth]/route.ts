import NextAuth from "next-auth";
import SpotifyProvider from "next-auth/providers/spotify";
import { NextAuthOptions } from "next-auth";
import mongoose from "mongoose";
import User from "@/models/User";

/**
 * Configuration options for NextAuth
 * Defines authentication providers and callbacks
 */
export const authOptions: NextAuthOptions = {
  providers: [
    SpotifyProvider({
      clientId: process.env.SPOTIFY_CLIENT_ID as string,
      clientSecret: process.env.SPOTIFY_CLIENT_SECRET as string,
      authorization: {
        params: {
          scope: "user-read-email user-read-private playlist-read-private playlist-read-collaborative",
        },
      },
    }),
  ],
  secret: process.env.NEXTAUTH_SECRET,
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  callbacks: {
    async signIn({ user, account, profile }) {
      try {
        // Connect to MongoDB
        if (mongoose.connection.readyState !== 1) {
          await mongoose.connect(process.env.MONGODB_URI as string);
        }
        
        // Check if user exists
        const existingUser = await User.findOne({ email: user.email });
        
        if (existingUser) {
          // Update user if needed
          await User.findOneAndUpdate(
            { email: user.email },
            { 
              $set: { 
                name: user.name,
                image: user.image
              },
              $addToSet: {
                accounts: {
                  platform: "spotify",
                  platformId: profile?.id,
                  accessToken: account?.access_token,
                  refreshToken: account?.refresh_token,
                  expiresAt: account?.expires_at
                }
              }
            }
          );
          
          // Add the MongoDB ID to the user object
          user.id = existingUser._id.toString();
        } else {
          // Create new user
          const newUser = await User.create({
            name: user.name,
            email: user.email,
            image: user.image,
            accounts: [{
              platform: "spotify",
              platformId: profile?.id,
              accessToken: account?.access_token,
              refreshToken: account?.refresh_token,
              expiresAt: account?.expires_at
            }]
          });
          
          // Add the MongoDB ID to the user object
          user.id = newUser._id.toString();
        }
        
        return true;
      } catch (error) {
        console.error("Error in signIn callback:", error);
        return false;
      }
    },
    async jwt({ token, account, user }) {
      // Initial sign in
      if (account && user) {
        console.log("JWT callback - user:", user);
        return {
          ...token,
          accessToken: account.access_token,
          refreshToken: account.refresh_token,
          accessTokenExpires: account.expires_at,
          id: user.id,
          userId: user.id // Add userId directly to token
        };
      }

      return token;
    },
    async session({ session, token }) {
      console.log("Session callback - token:", token);
      
      // Add user ID to session
      session.user = {
        ...session.user,
        id: token.id || token.userId || token.sub
      };
      
      if (token.accessToken) {
        session.accessToken = token.accessToken as string;
      }
      
      console.log("Session callback - returning session:", session);
      return session;
    },
  },
  debug: process.env.NODE_ENV === "development",
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST }; 