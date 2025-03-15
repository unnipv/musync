import mongoose, { Schema, Document } from 'mongoose';
import bcrypt from 'bcrypt';

/**
 * Interface for User document
 */
export interface IUser extends Document {
  name: string;
  email: string;
  password?: string;
  image?: string;
  platforms: IPlatform[];
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Platform schema for connected music services
 */
const PlatformSchema = new Schema({
  name: {
    type: String,
    required: true,
    enum: ['spotify', 'youtube']
  },
  userId: {
    type: String,
    required: true
  },
  lastSyncedAt: {
    type: Date,
    default: null
  }
}, { _id: false });

/**
 * User schema
 */
const UserSchema = new Schema<IUser>(
  {
    name: {
      type: String,
      required: [true, 'Please provide a name'],
      maxlength: [60, 'Name cannot be more than 60 characters'],
    },
    email: {
      type: String,
      required: [true, 'Please provide an email'],
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      // Not required because OAuth users won't have a password
    },
    image: {
      type: String,
    },
    platforms: {
      type: [PlatformSchema],
      default: []
    },
    // For backward compatibility
    spotifyId: {
      type: String,
    },
    youtubeId: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

// Hash password before saving
UserSchema.pre('save', async function(next) {
  const user = this;
  
  // Only hash the password if it has been modified (or is new)
  if (!user.isModified('password') || !user.password) return next();
  
  try {
    // Generate a salt
    const salt = await bcrypt.genSalt(10);
    
    // Hash the password along with the new salt
    const hash = await bcrypt.hash(user.password, salt);
    
    // Override the cleartext password with the hashed one
    user.password = hash;
    next();
  } catch (error) {
    next(error as Error);
  }
});

/**
 * Compares a provided password with the user's hashed password
 * @param candidatePassword - The password to compare
 * @returns A promise that resolves to a boolean indicating if the passwords match
 */
UserSchema.methods.comparePassword = async function(candidatePassword: string): Promise<boolean> {
  try {
    if (!this.password) return false;
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    return false;
  }
};

/**
 * Pre-save hook to update the updatedAt field
 */
UserSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  
  // If spotifyId exists but not in platforms array, add it
  if (this.spotifyId && !this.platforms.some(p => p.name === 'spotify')) {
    this.platforms.push({
      name: 'spotify',
      userId: this.spotifyId,
      lastSyncedAt: null
    });
  }
  
  // If youtubeId exists but not in platforms array, add it
  if (this.youtubeId && !this.platforms.some(p => p.name === 'youtube')) {
    this.platforms.push({
      name: 'youtube',
      userId: this.youtubeId,
      lastSyncedAt: null
    });
  }
  
  next();
});

/**
 * User model
 */
export const User = mongoose.models.User || mongoose.model<IUser>('User', UserSchema);

export default User; 