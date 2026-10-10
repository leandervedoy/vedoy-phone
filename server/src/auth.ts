import { createRemoteJWKSet, errors, jwtVerify } from 'jose';
import type { Request, Response, NextFunction } from 'express';
import { db } from './clients.js';
import { env } from './config.js';

declare global {
  namespace Express {
    interface Request {
      userId?: string;
      isAdmin?: boolean;
    }
  }
}

const issuer = new URL(env.NEON_AUTH_BASE_URL).origin;
const jwks = createRemoteJWKSet(new URL(`${env.NEON_AUTH_BASE_URL}/.well-known/jwks.json`));
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authorization = req.header('authorization');
  const match = authorization && /^Bearer ([^\s]+)$/i.exec(authorization);
  if (!match) return res.status(401).json({ message: 'Logg inn for å fortsette.' });

  let userId: string;
  try {
    const { payload } = await jwtVerify(match[1]!, jwks, {
      algorithms: ['EdDSA'],
      issuer,
      audience: issuer,
    });
    if (typeof payload.sub !== 'string' || !uuidPattern.test(payload.sub)) {
      return res.status(401).json({ message: 'Økten er ugyldig.' });
    }
    userId = payload.sub;
  } catch (error) {
    if (error instanceof errors.JOSEError) {
      return res.status(401).json({ message: 'Økten er utløpt eller ugyldig.' });
    }
    return next(error);
  }

  try {
    const users = await db`
      SELECT role, banned
      FROM neon_auth."user"
      WHERE id = ${userId}::uuid
      LIMIT 1
    `;
    if (!users.length) return res.status(401).json({ message: 'Brukerkontoen finnes ikke lenger.' });
    if (users[0]?.banned) return res.status(403).json({ message: 'Brukerkontoen er deaktivert.' });
    req.userId = userId;
    req.isAdmin = users[0]?.role === 'admin';
    return next();
  } catch (error) {
    return next(error);
  }
}
