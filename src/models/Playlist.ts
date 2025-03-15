import mongoose, { Schema, Document } from 'mongoose';

// Define the Track interface
export interface ITrack extends Document {
  _id: mongoose.Types.ObjectId;
  title: string;
  artist: string;
  album?: string;
  duration?: number;
  imageUrl?: string;
  externalUrl?: string;
  platformId: string;
  platform: string;
}

// Define the Track schema
const TrackSchema = new Schema<ITrack>({
  title: { type: String, required: true },
  artist: { type: String, required: true },
  album: { type: String },
  duration: { type: Number },
  imageUrl: { type: String },
  externalUrl: { type: String },
  platformId: { type: String, required: true },
  platform: { type: String, required: true }
}, { timestamps: true });

// Define the Playlist interface
export interface IPlaylist extends Document {
  name: string;
  description?: string;
  userId: mongoose.Types.ObjectId | string;
  tracks: ITrack[];
  isPublic: boolean;
  coverImage?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Define the Playlist schema
const PlaylistSchema = new Schema<IPlaylist>({
  name: { type: String, required: true },
  description: { type: String },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  tracks: [TrackSchema],
  isPublic: { type: Boolean, default: false },
  coverImage: { type: String },
  spotifyId: { type: String, default: null },
  youtubeId: { type: String, default: null },
  lastSyncedAt: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

// Update the updatedAt field on save
PlaylistSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

/**
 * Mongoose model for playlists
 * Handles playlist data storage and retrieval
 */
const Playlist = mongoose.models.Playlist || mongoose.model<IPlaylist>('Playlist', PlaylistSchema);

export default Playlist; 