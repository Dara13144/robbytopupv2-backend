import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../prisma';
import { authenticateJWT, AuthenticatedRequest } from '../middleware/auth';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key-change-in-production-12345';

// Register Route
router.post('/register', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Check if email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return res.status(400).json({ error: 'Email is already registered' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // If first user, make ADMIN, else USER
    const userCount = await prisma.user.count();
    const role = userCount === 0 ? 'ADMIN' : 'USER';

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        role,
      },
    });

    // Generate JWT token
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.status(201).json({
      message: 'User registered successfully',
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('Registration error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Login Route
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    let user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Ensure mdara9695@gmail.com is always ADMIN
    if (user.email.toLowerCase() === 'mdara9695@gmail.com' && user.role !== 'ADMIN') {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { role: 'ADMIN' },
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.status(200).json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Get Current User Profile Route
router.get('/me', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        email: true,
        role: true,
        createdAt: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.status(200).json({ user });
  } catch (error) {
    console.error('Get profile error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Google OAuth Sign-In Route
router.post('/google', async (req, res) => {
  try {
    const { credential, email: rawEmail, name: rawName } = req.body;

    if (!credential && !rawEmail) {
      return res.status(400).json({ error: 'Google credential is required' });
    }

    let email = (rawEmail || '').trim().toLowerCase();
    let name = rawName;

    // Verify credential via Google tokeninfo (id_token, access_token) or JWT payload decode
    if (credential) {
      try {
        let googleRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${credential}`);
        if (!googleRes.ok) {
          // Check if credential is an access token
          googleRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?access_token=${credential}`);
        }
        if (!googleRes.ok) {
          // Check Google userinfo endpoint with Bearer authorization
          googleRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: { Authorization: `Bearer ${credential}` },
          });
        }

        if (googleRes.ok) {
          const payload: any = await googleRes.json();
          if (payload.email) {
            email = payload.email.trim().toLowerCase();
            name = payload.name || payload.given_name || name;
          }
        } else {
          // Fallback: decode base64 JWT payload directly
          const parts = credential.split('.');
          if (parts.length === 3) {
            const decoded = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
            if (decoded.email) {
              email = decoded.email.trim().toLowerCase();
              name = decoded.name || name;
            }
          }
        }
      } catch (tokenErr) {
        console.warn('[Auth] Google tokeninfo verification fallback:', tokenErr);
        const parts = credential.split('.');
        if (parts.length === 3) {
          const decoded = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
          if (decoded.email) {
            email = decoded.email.trim().toLowerCase();
            name = decoded.name || name;
          }
        }
      }
    }

    if (!email) {
      return res.status(400).json({ error: 'Failed to retrieve email from Google credential' });
    }

    // Determine admin role: mdara9695@gmail.com is ALWAYS ADMIN
    const isAdmin = email === 'mdara9695@gmail.com';

    let user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      const generatedPass = await bcrypt.hash(`google_${Date.now()}_${Math.random()}`, 10);
      user = await prisma.user.create({
        data: {
          email,
          password: generatedPass,
          role: isAdmin ? 'ADMIN' : 'USER',
        },
      });
      console.log(`[Auth] Registered new Google user: ${email} (${user.role})`);
    } else if (isAdmin && user.role !== 'ADMIN') {
      user = await prisma.user.update({
        where: { email },
        data: { role: 'ADMIN' },
      });
      console.log(`[Auth] Elevated Google account to ADMIN: ${email}`);
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.status(200).json({
      message: 'Google login successful',
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error: any) {
    console.error('Google login route error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error during Google login' });
  }
});

export default router;
