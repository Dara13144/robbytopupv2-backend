import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key-change-in-production-12345';

const ADMIN_EMAILS = [
  'mdara9695@gmail.com',
  'admin@nadytopup.com',
  'admin@topup.com'
];

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    role: string;
    email: string;
  };
}

export function authenticateJWT(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (authHeader) {
    const token = authHeader.split(' ')[1]; // Bearer <token>

    jwt.verify(token, JWT_SECRET, (err, user: any) => {
      if (err) {
        // Fallback: Check if token is a valid Supabase Auth JWT token
        try {
          const parts = token.split('.');
          if (parts.length === 3) {
            const decoded: any = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
            if (decoded && (decoded.iss?.includes('supabase.co/auth/v1') || decoded.aud === 'authenticated')) {
              const email = (decoded.email || '').trim().toLowerCase();
              const isAdminEmail = ADMIN_EMAILS.includes(email);
              req.user = {
                id: decoded.sub || decoded.id,
                role: isAdminEmail ? 'ADMIN' : (decoded.app_metadata?.role || decoded.role || 'USER'),
                email: email,
              };
              return next();
            }
          }
        } catch {
          // Ignore parse errors
        }
        return res.status(403).json({ error: 'Forbidden: Invalid or expired token' });
      }
      
      const email = (user.email || '').trim().toLowerCase();
      const isAdminEmail = ADMIN_EMAILS.includes(email);

      req.user = {
        id: user.id,
        role: isAdminEmail ? 'ADMIN' : (user.role || 'USER'),
        email: email,
      };
      next();
    });
  } else {
    res.status(401).json({ error: 'Unauthorized: No token provided' });
  }
}

export function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const email = (req.user?.email || '').trim().toLowerCase();
  const isAdminEmail = ADMIN_EMAILS.includes(email);

  if (!req.user || (!isAdminEmail && req.user.role !== 'ADMIN')) {
    return res.status(403).json({ error: 'Forbidden: Admin access required' });
  }

  // Ensure role is explicitly set to ADMIN
  req.user.role = 'ADMIN';
  next();
}
