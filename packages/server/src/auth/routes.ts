import { Router } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { User } from '../database/models.js'

const JWT_SECRET = process.env.JWT_SECRET || 'AMAZON_PRIME_SECRET_2026'

export interface AuthUser {
  id: string
  name: string
  email: string
}

export function createAuthRouter(): Router {
  const router = Router()

  // POST /api/auth/register
  router.post('/register', async (req, res) => {
    try {
      const { name, email, password } = req.body
      if (!name || !email || !password) {
        res.status(400).json({ error: 'Name, email and password are required' })
        return
      }
      if (password.length < 6) {
        res.status(400).json({ error: 'Password must be at least 6 characters' })
        return
      }

      const existing = await User.findOne({ email: email.toLowerCase() })
      if (existing) {
        res.status(409).json({ error: 'Email already registered' })
        return
      }

      const hashed = await bcrypt.hash(password, 10)
      const user = await User.create({ name, email: email.toLowerCase(), password: hashed })
      const token = jwt.sign({ id: user._id.toString(), email: user.email, name: user.name }, JWT_SECRET, { expiresIn: '30d' })

      res.status(201).json({ token, user: { id: user._id, name: user.name, email: user.email } })
    } catch (err) {
      console.error('[Auth] Register error:', err)
      res.status(500).json({ error: 'Registration failed' })
    }
  })

  // POST /api/auth/login
  router.post('/login', async (req, res) => {
    try {
      const { email, password } = req.body
      if (!email || !password) {
        res.status(400).json({ error: 'Email and password are required' })
        return
      }

      const user = await User.findOne({ email: email.toLowerCase() })
      if (!user) {
        res.status(401).json({ error: 'Invalid email or password' })
        return
      }

      const valid = await bcrypt.compare(password, user.password)
      if (!valid) {
        res.status(401).json({ error: 'Invalid email or password' })
        return
      }

      const token = jwt.sign({ id: user._id.toString(), email: user.email, name: user.name }, JWT_SECRET, { expiresIn: '30d' })
      res.json({ token, user: { id: user._id, name: user.name, email: user.email } })
    } catch (err) {
      console.error('[Auth] Login error:', err)
      res.status(500).json({ error: 'Login failed' })
    }
  })

  // GET /api/auth/me
  router.get('/me', authMiddleware, async (req: any, res) => {
    const user = await User.findById(req.user.id).select('-password')
    if (!user) { res.status(404).json({ error: 'User not found' }); return }
    res.json({ user })
  })

  return router
}

// Auth middleware
export function authMiddleware(req: any, res: any, next: any) {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Not authorized — no token' })
    return
  }
  try {
    req.user = jwt.verify(header.split(' ')[1], JWT_SECRET) as AuthUser
    next()
  } catch {
    res.status(401).json({ error: 'Not authorized — invalid token' })
  }
}

export { JWT_SECRET }
