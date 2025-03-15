import { MongoClient, Db } from 'mongodb';

/**
 * Global MongoDB client and database connection
 */
interface MongoConnection {
  client: MongoClient | null;
  db: Db | null;
  promise: Promise<{ client: MongoClient; db: Db }> | null;
}

/**
 * Global MongoDB connection object
 */
const globalWithMongo = global as typeof global & {
  mongo: MongoConnection;
};

// Initialize the global MongoDB connection object
if (!globalWithMongo.mongo) {
  globalWithMongo.mongo = {
    client: null,
    db: null,
    promise: null,
  };
}

/**
 * Connects to the MongoDB database
 * 
 * @returns A promise that resolves to the MongoDB client and database
 */
export async function connectToDatabase(): Promise<{ client: MongoClient; db: Db }> {
  // If we already have a connection, return it
  if (globalWithMongo.mongo.client && globalWithMongo.mongo.db) {
    return {
      client: globalWithMongo.mongo.client,
      db: globalWithMongo.mongo.db,
    };
  }

  // If a connection is being established, return the promise
  if (globalWithMongo.mongo.promise) {
    return globalWithMongo.mongo.promise;
  }

  // Get the MongoDB connection URI from environment variables
  const MONGODB_URI = process.env.MONGODB_URI;

  if (!MONGODB_URI) {
    throw new Error('Please define the MONGODB_URI environment variable');
  }

  // Create a new connection promise
  globalWithMongo.mongo.promise = new Promise((resolve, reject) => {
    const client = new MongoClient(MONGODB_URI as string);

    client
      .connect()
      .then((client) => {
        const db = client.db();
        globalWithMongo.mongo.client = client;
        globalWithMongo.mongo.db = db;
        resolve({ client, db });
      })
      .catch((error) => {
        reject(error);
      });
  });

  return globalWithMongo.mongo.promise;
} 