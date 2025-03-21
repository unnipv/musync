import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * Interface for platform-specific data
 */
export interface PlatformData {
  platform: string;
  id: string;
  platformId?: string;
  lastSyncedAt?: Date;
  syncStatus?: string;
  syncError?: string;
  url?: string;
}

/**
 * Interface representing a Playlist document in MongoDB
 */
export interface IPlaylist extends Document {
  userId: mongoose.Types.ObjectId;
  name: string;
  title?: string; // Alternative name field
  description?: string;
  isPublic: boolean;
  spotifyId?: string;
  youtubeId?: string;
  lastSyncedAt?: Date;
  platformData?: PlatformData[];
  tracks: Array<{
    _id: mongoose.Types.ObjectId;
    title: string;
    artist: string;
    album?: string;
    duration?: number;
    platformId?: string;
    platform?: string;
    uri?: string;
    spotifyId?: string;
    youtubeId?: string;
    imageUrl?: string;
    addedAt: Date;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Mongoose schema for Playlist
 */
const PlaylistSchema: Schema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    title: {
      type: String,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    isPublic: {
      type: Boolean,
      default: false,
    },
    spotifyId: {
      type: String,
      index: true,
    },
    youtubeId: {
      type: String,
      index: true,
    },
    lastSyncedAt: {
      type: Date,
    },
    platformData: [
      {
        platform: String,
        id: String,
        platformId: String,
        lastSyncedAt: Date,
        syncStatus: String,
        syncError: String,
        url: String,
      }
    ],
    tracks: [
      {
        title: {
          type: String,
          required: true,
        },
        artist: {
          type: String,
          required: true,
        },
        album: String,
        duration: Number,
        platformId: String,
        platform: String,
        uri: String,
        spotifyId: String,
        youtubeId: String,
        imageUrl: String,
        addedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  {
    timestamps: true,
  }
);

// Create or retrieve the Playlist model
const Playlist: Model<IPlaylist> = 
  mongoose.models.Playlist || mongoose.model<IPlaylist>('Playlist', PlaylistSchema);

export default Playlist; 