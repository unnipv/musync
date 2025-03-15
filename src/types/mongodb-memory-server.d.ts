declare module 'mongodb-memory-server' {
  export class MongoMemoryServer {
    static create(): Promise<MongoMemoryServer>;
    getUri(): string;
    stop(): Promise<void>;
  }
} 