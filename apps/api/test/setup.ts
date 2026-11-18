import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { createApp } from '../src/server.js';
import { Application } from 'express';

let mongod: MongoMemoryServer;
let app: Application;

export async function setupTestEnvironment() {
  mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();

  await mongoose.connect(uri);
  app = createApp();

  return { app, uri };
}

export async function teardownTestEnvironment() {
  await mongoose.disconnect();
  if (mongod) {
    await mongod.stop();
  }
}

export async function clearTestDatabase() {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
}
