import mongoose from 'mongoose';
import { env } from './env.js';
import { logger } from './logger.js';

let memoryServerInstance: any = null;

export async function connectDB(uri?: string): Promise<typeof mongoose> {
  const mongoUri = uri || env.MONGODB_URI;
  try {
    const conn = await mongoose.connect(mongoUri, {
      autoIndex: true,
      serverSelectionTimeoutMS: 2000,
    });
    logger.info(`MongoDB Connected: ${conn.connection.host}`);
    return conn;
  } catch (error: any) {
    if (env.NODE_ENV === 'development') {
      logger.warn(`Could not connect to ${mongoUri} (${error.message}). Starting in-memory MongoDB for local development...`);
      try {
        const { MongoMemoryServer } = await import('mongodb-memory-server');
        memoryServerInstance = await MongoMemoryServer.create();
        const memoryUri = memoryServerInstance.getUri();
        const conn = await mongoose.connect(memoryUri, { autoIndex: true });
        logger.info(`In-Memory MongoDB Connected at: ${memoryUri}`);
        return conn;
      } catch (memErr: any) {
        logger.error('Failed to start in-memory MongoDB fallback:', { error: memErr.message });
      }
    }
    logger.error('Error connecting to MongoDB:', { error });
    throw error;
  }
}

export async function disconnectDB(): Promise<void> {
  await mongoose.disconnect();
  if (memoryServerInstance) {
    await memoryServerInstance.stop();
    memoryServerInstance = null;
  }
  logger.info('MongoDB disconnected');
}

export async function withTransaction<T>(
  fn: (session?: mongoose.ClientSession) => Promise<T>
): Promise<T> {
  let supportsTransactions = false;
  try {
    const client = mongoose.connection.getClient() as any;
    const topologyType = client?.topology?.description?.type || '';
    supportsTransactions =
      topologyType.includes('ReplicaSet') ||
      topologyType.includes('Sharded') ||
      topologyType === 'LoadBalanced';
  } catch {
    supportsTransactions = false;
  }

  if (!supportsTransactions) {
    return await fn(undefined);
  }

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const result = await fn(session);
    await session.commitTransaction();
    return result;
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
}
