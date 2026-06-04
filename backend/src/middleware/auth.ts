import { Request, Response, NextFunction } from 'express';
import { auth } from '../config/firebase.js';

export interface AuthenticatedRequest extends Request {
  user?: {
    uid: string;
    email?: string;
    role?: 'admin' | 'user';
  };
}

export async function authMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  const authHeader = req.headers.authorization;
  
  // For development ease, if auth is disabled in non-production, we can bypass if key is dummy,
  // but to keep it secure and SaaS production-ready, we verify token.
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing authorization header.' });
  }

  const token = authHeader.split('Bearer ')[1];
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized: Token is empty.' });
  }

  try {
    const decodedToken = await auth.verifyIdToken(token);
    
    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email,
      role: (decodedToken.role as 'admin' | 'user') || 'user',
    };
    
    next();
  } catch (error: any) {
    console.error('Firebase auth token verification error:', error);
    res.status(401).json({ error: 'Unauthorized: Invalid or expired token.', details: error.message });
  }
}
