import mongoose from './mongo.js'

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true },
  watchlist: [{ type: String }],
  playbackHistory: [{
    mediaId: { type: String, required: true },
    title: { type: String, default: '' },
    type: { type: String, default: 'movie' },
    posterPath: { type: String, default: '' },
    progress: { type: Number, default: 0 },
    duration: { type: Number, default: 0 },
    lastWatched: { type: Date, default: Date.now },
  }],
}, { timestamps: true })

export const User = mongoose.model('User', userSchema)
