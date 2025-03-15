import mongoose, { Schema, Document } from 'mongoose';

// Define the Account interface for linked platform accounts
interface IAccount {
  platform: string;
  platformId: string;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
}

// Define the Account schema
const AccountSchema = new Schema({
  platform: { type: String, required: true },
  platformId: { type: String, required: true },
  accessToken: { type: String },
  refreshToken: { type: String },
  expiresAt: { type: Number }
});

// Define the User interface
export interface IUser extends Document {
  name: string;
  email: string;
  image?: string;
  accounts: IAccount[];
  createdAt: Date;
  updatedAt: Date;
}

// Define the User schema
const UserSchema = new Schema<IUser>({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  image: { type: String },
  accounts: [AccountSchema]
}, { timestamps: true });

/**
 * Mongoose model for users
 * Handles user data storage and retrieval
 */
const User = mongoose.models.User || mongoose.model<IUser>('User', UserSchema);

export default User; 