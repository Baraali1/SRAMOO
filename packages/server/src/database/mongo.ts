import dotenv from 'dotenv'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import mongoose from 'mongoose'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
// .env is at packages/server/.env, dist is at packages/server/dist/database/
dotenv.config({ path: path.join(__dirname, '../../.env') })

const MONGODB_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/sramo_db'

export async function connectDB(): Promise<void> {
  try {
    await mongoose.connect(MONGODB_URI)
    console.log('[MongoDB] Connected —', mongoose.connection.db?.databaseName)
  } catch (err) {
    console.warn('[MongoDB] Unavailable — auth disabled. Streaming works without it.')
  }
}

export default mongoose
