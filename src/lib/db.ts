import mongoose from 'mongoose'

// Global cached connection (prevents re-connection on every API call in dev/serverless)
let cached = (global as any).mongoose

if (!cached) {
    cached = (global as any).mongoose = { conn: null, promise: null }
}

async function connectToDatabase() {
    const MONGODB_URI = process.env.MONGODB_URI

    if (!MONGODB_URI) {
        throw new Error('Please define the MONGODB_URI environment variable inside .env.local')
    }

    if (cached.conn) {
        return cached.conn
    }

    if (!cached.promise) {
        const opts: mongoose.ConnectOptions = {
            bufferCommands: false,
            // Production-grade connection pool settings
            maxPoolSize: 10,              // Max connections in pool
            minPoolSize: 2,               // Keep at least 2 connections warm
            serverSelectionTimeoutMS: 10000,  // Fail fast if server unreachable
            socketTimeoutMS: 45000,        // Close sockets after 45s inactivity
            heartbeatFrequencyMS: 10000,   // Check server health every 10s
            retryWrites: true,             // Auto-retry failed writes
            retryReads: true,              // Auto-retry failed reads
        }

        cached.promise = mongoose.connect(MONGODB_URI, opts).then((mongoose) => {
            return mongoose
        })
    }

    try {
        cached.conn = await cached.promise
    } catch (e) {
        cached.promise = null
        console.error('[MongoDB] Connection failed:', e)
        throw e
    }

    return cached.conn
}

export default connectToDatabase
