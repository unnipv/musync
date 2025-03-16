import mongoose, { Connection } from 'mongoose';
import { MongoClient, MongoClientOptions } from 'mongodb';

declare global {
  // eslint-disable-next-line no-var
  var mongoose: {
    conn: mongoose.Mongoose | null;
    promise: Promise<mongoose.Mongoose> | null;
  };
}

if (!process.env.MONGODB_URI) {
  throw new Error('Please add your MongoDB URI to .env.local');
}

const MONGODB_URI = process.env.MONGODB_URI;

/**
 * MongoDB connection options with updated SSL/TLS settings
 * to address connection issues
 */
const mongooseOptions = {
  bufferCommands: false,
  // Add tls settings to fix TLS issues
  ssl: true,
  tls: true,
  // Increased timeouts for better reliability
  serverSelectionTimeoutMS: 15000,
  socketTimeoutMS: 45000,
};

/**
 * MongoDB client options with updated SSL/TLS settings
 */
const mongoClientOptions: MongoClientOptions = {
  ssl: true,
  tls: true,
  // These options are deprecated in newer MongoDB drivers
  // useNewUrlParser: true, 
  // useUnifiedTopology: true,
  // Increased timeouts for better reliability
  serverSelectionTimeoutMS: 15000,
  socketTimeoutMS: 45000,
};

/**
 * Global variables to cache the MongoDB connection
 */
let cachedClient: any = null;
let cachedDb: any = null;
let connectionAttempts = 0;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

/**
 * Helper function to delay execution
 * @param ms Time to delay in milliseconds
 */
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Enum to ensure proper readystate values in type-safe way
 */
enum ConnectionReadyState {
  Disconnected = 0,
  Connected = 1,
  Connecting = 2,
  Disconnecting = 3
}

/**
 * Global is used here to maintain a cached connection across hot reloads
 * in development. This prevents connections growing exponentially
 * during API Route usage.
 */
let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

/**
 * Connects to MongoDB using Mongoose
 * @returns Mongoose connection
 */
async function connectDB() {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    try {
      cached.promise = mongoose.connect(MONGODB_URI, mongooseOptions);
    } catch (err) {
      console.error('Initial Mongoose connection error:', err);
      cached.promise = null;
      throw err;
    }
  }

  try {
    cached.conn = await cached.promise;
  } catch (e) {
    console.error('Mongoose connection error:', e);
    
    // If this is a TLS error, try with fallback options
    if (e instanceof Error && 
        (e.message.includes('SSL routines') || 
         e.message.includes('tlsv1 alert'))) {
      console.warn('TLS/SSL error detected in Mongoose connection. Trying fallback options...');
      
      try {
        // Create new options with less strict TLS settings
        const fallbackMongooseOptions = {
          bufferCommands: false,
          ssl: true,
          tls: true,
          tlsAllowInvalidCertificates: true,
          serverSelectionTimeoutMS: 15000,
          socketTimeoutMS: 45000,
        };
        
        // Reset the promise and try again with fallback options
        cached.promise = mongoose.connect(MONGODB_URI, fallbackMongooseOptions);
        cached.conn = await cached.promise;
        console.log('Mongoose connected successfully with fallback options');
        return cached.conn;
      } catch (fallbackError) {
        console.error('Fallback Mongoose connection also failed:', fallbackError);
        cached.promise = null;
        throw fallbackError;
      }
    }
    
    cached.promise = null;
    throw e;
  }

  return cached.conn;
}

/**
 * Connects to MongoDB and returns the client and database objects
 * 
 * @returns An object containing the MongoDB client and database
 */
export async function connectToDatabase() {
  if (cachedClient && cachedDb) {
    // If we already have a connection, use it
    return { client: cachedClient, db: cachedDb };
  }
  
  // Reset connection attempts for new connection 
  connectionAttempts = 0;
  
  // Get MongoDB URI from environment variable
  const uri = process.env.MONGODB_URI;
  
  if (!uri) {
    throw new Error('MongoDB URI is not defined in environment variables');
  }
  
  // Try to connect with retry logic
  while (connectionAttempts < MAX_RETRIES) {
    try {
      console.log(`Connecting to MongoDB (attempt ${connectionAttempts + 1})...`);
      
      // Wait for any existing connection attempts to finish
      if (mongoose.connection.readyState === 2) { // 2 = connecting
        console.log('MongoDB connection is already in progress, waiting...');
        await new Promise<void>((resolve) => {
          const checkConnection = () => {
            if (mongoose.connection.readyState === 1) { // 1 = connected
              resolve();
            } else if (mongoose.connection.readyState === 0 || mongoose.connection.readyState === 3) {
              // 0 = disconnected, 3 = disconnecting
              resolve();
            } else {
              // Still connecting, check again in 500ms
              setTimeout(checkConnection, 500);
            }
          };
          checkConnection();
        });
      }
      
      // Only connect if we're not already connected
      if (mongoose.connection.readyState !== 1) { // 1 = connected
        // Try connecting with the standard format
        try {
          await mongoose.connect(uri, {
            maxPoolSize: 10,
            serverSelectionTimeoutMS: 5000
          });
          console.log('Connected to MongoDB using standard format');
        } catch (err) {
          // If standard format fails, try Atlas direct connection format
          console.error('Error connecting with standard format:', err);
          console.log('Attempting connection with direct MongoDB Atlas format...');
          
          const atlasURI = uri.replace('mongodb+srv://', 'mongodb://');
          await mongoose.connect(atlasURI, {
            maxPoolSize: 10,
            serverSelectionTimeoutMS: 5000
          });
          console.log('Connected to MongoDB using direct Atlas format');
        }
      }
      
      // If we get here, we're connected
      const client = mongoose.connection.getClient();
      const db = mongoose.connection.db;
      
      // Cache the client and database for future use
      cachedClient = client;
      cachedDb = db;
      
      return { client, db };
    } catch (error) {
      connectionAttempts++;
      
      console.error(`MongoDB connection attempt ${connectionAttempts} failed:`, error);
      
      if (connectionAttempts >= MAX_RETRIES) {
        console.error(`Failed to connect to MongoDB after ${MAX_RETRIES} attempts`);
        
        // Set a flag in the app context that we're in offline mode
        (global as any).OFFLINE_MODE = true;
        
        // Throw a specific error for offline mode handling
        throw new Error(`MongoDB connection failed after ${MAX_RETRIES} attempts. Operating in offline mode.`);
      }
      
      // Wait before retrying
      console.log(`Retrying in ${RETRY_DELAY_MS}ms...`);
      await delay(RETRY_DELAY_MS * connectionAttempts); // Increase delay with each attempt
    }
  }
  
  // This should never be reached due to the retry logic, but TypeScript requires a return statement
  throw new Error('Failed to connect to MongoDB');
}

/**
 * Checks if the application is in offline mode
 * 
 * @returns True if the application is in offline mode
 */
export function isOfflineMode() {
  return !!(global as any).OFFLINE_MODE;
}

// For backward compatibility
export default connectToDatabase; 