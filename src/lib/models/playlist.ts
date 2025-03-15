import mongoose, { Schema, Document, Model } from 'mongoose';
import { ObjectId } from 'mongodb';

/**
 * Interface for platform-specific data
 */
export interface PlatformData {
  platform: string;
  id: string;
  platformId?: string;
  url?: string;
  lastSyncedAt?: Date;
  syncStatus?: string;
  syncError?: string;
  synced?: boolean;
}

/**
 * Interface for playlist tracks
 */
export interface PlaylistTrack {
  title: string;
  artist: string;
  album: string;
  duration?: number;
  addedAt: Date;
  id?: string;
  imageUrl?: string;
  platform?: string;
  spotifyId?: string;
  youtubeId?: string;
  platformData?: {
    provider: string;
    id: string;
    url: string;
  }[];
}

/**
 * Interface for Playlist document
 */
export interface PlaylistSchema extends Document {
  title: string;
  name?: string; // For backward compatibility
  description?: string;
  userId: string | mongoose.Types.ObjectId;
  tracks: PlaylistTrack[];
  platformData?: PlatformData[];
  spotifyId?: string | null; // Add this for backward compatibility
  youtubeId?: string | null; // Add this for backward compatibility
  isPublic?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Playlist document with _id
 */
export interface PlaylistDocument extends PlaylistSchema {
  _id: mongoose.Types.ObjectId;
}

const playlistSchema = new Schema<PlaylistSchema>({
  userId: {
    type: Schema.Types.ObjectId,
    required: true,
    index: true
  },
  name: {
    type: String,
    trim: true
  },
  title: {
    type: String,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  isPublic: {
    type: Boolean,
    default: false
  },
  tracks: [{
    title: String,
    artist: String,
    album: String,
    duration: Number,
    spotifyId: String,
    youtubeId: String,
    addedAt: Date,
    id: String,
    imageUrl: String,
    platform: String,
    platformData: [{
      provider: String,
      id: String,
      url: String
    }]
  }],
  platformData: [{
    platform: String,
    id: String,
    platformId: String,
    url: String,
    lastSyncedAt: Date,
    syncStatus: String,
    syncError: String,
    synced: Boolean
  }],
  spotifyId: String,
  youtubeId: String
}, {
  timestamps: true
});

// Create indexes
playlistSchema.index({ userId: 1, createdAt: -1 });
playlistSchema.index({ isPublic: 1 });

// Ensure model is only created once
const Playlist: Model<PlaylistSchema> = mongoose.models.Playlist || mongoose.model<PlaylistSchema>('Playlist', playlistSchema);

export default Playlist; 