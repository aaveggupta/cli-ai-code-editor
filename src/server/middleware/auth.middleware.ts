import { Request, Response, NextFunction } from 'express';
import { authService } from '../../services/auth.service';
import { User } from '../../models/User';

export interface AuthRequest extends Request {
  user?: User;
}

export async function authenticateToken(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    res.status(401).json({ error: 'Access token required' });
    return;
  }

  const user = await authService.verifyToken(token);

  if (!user) {
    res.status(403).json({ error: 'Invalid or expired token' });
    return;
  }

  req.user = user;
  next();
}

export async function authenticateApiKey(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const apiKey = req.headers['x-api-key'] as string;

  if (!apiKey) {
    res.status(401).json({ error: 'API key required' });
    return;
  }

  const user = await authService.verifyApiKey(apiKey);

  if (!user) {
    res.status(403).json({ error: 'Invalid API key' });
    return;
  }

  req.user = user;
  next();
}

export async function authenticate(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;
  const apiKey = req.headers['x-api-key'] as string;

  if (authHeader) {
    await authenticateToken(req, res, next);
  } else if (apiKey) {
    await authenticateApiKey(req, res, next);
  } else {
    res.status(401).json({ error: 'Authentication required (Bearer token or API key)' });
  }
}
