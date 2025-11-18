import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getDatabase } from '../database';
import { User, CreateUserInput, UserResponse } from '../models/User';
import { config } from '../config';
import { generateApiKey, generateId } from '../utils/crypto';
import { redisService } from './redis.service';

const SESSION_PREFIX = 'session:';
const SESSION_EXPIRY = 7 * 24 * 60 * 60; // 7 days in seconds

export class AuthService {
  async register(input: CreateUserInput): Promise<UserResponse> {
    const db = getDatabase();
    const hashedPassword = await bcrypt.hash(input.password, 10);
    const apiKey = generateApiKey();
    const userId = generateId();

    try {
      const stmt = db.prepare(`
        INSERT INTO users (id, username, email, password_hash, api_key)
        VALUES (?, ?, ?, ?, ?)
      `);

      stmt.run(userId, input.username, input.email, hashedPassword, apiKey);

      return {
        id: userId,
        username: input.username,
        email: input.email,
        api_key: apiKey,
        created_at: new Date().toISOString(),
      };
    } catch (error: any) {
      if (error.message.includes('UNIQUE constraint failed')) {
        throw new Error('Username or email already exists');
      }
      throw error;
    }
  }

  async login(username: string, password: string): Promise<{ user: UserResponse; token: string }> {
    const db = getDatabase();
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username) as User | undefined;

    if (!user) {
      throw new Error('Invalid credentials');
    }

    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      throw new Error('Invalid credentials');
    }

    const token = jwt.sign(
      { userId: user.id, username: user.username },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn } as jwt.SignOptions
    );

    // Store session in Redis
    await redisService.setJson(`${SESSION_PREFIX}${token}`, { userId: user.id }, SESSION_EXPIRY);

    return {
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        api_key: user.api_key,
        created_at: user.created_at,
      },
      token,
    };
  }

  async verifyToken(token: string): Promise<User | null> {
    try {
      // Check Redis cache first
      const cachedSession = await redisService.getJson<{ userId: string }>(`${SESSION_PREFIX}${token}`);

      if (cachedSession) {
        const db = getDatabase();
        const user = db.prepare('SELECT * FROM users WHERE id = ?').get(cachedSession.userId) as User | undefined;
        return user || null;
      }

      // If not in cache, verify JWT
      const decoded = jwt.verify(token, config.jwt.secret) as { userId: string };
      const db = getDatabase();
      const user = db.prepare('SELECT * FROM users WHERE id = ?').get(decoded.userId) as User | undefined;

      if (user) {
        // Update cache
        await redisService.setJson(`${SESSION_PREFIX}${token}`, { userId: user.id }, SESSION_EXPIRY);
        return user;
      }

      return null;
    } catch (error) {
      return null;
    }
  }

  async verifyApiKey(apiKey: string): Promise<User | null> {
    const db = getDatabase();
    const user = db.prepare('SELECT * FROM users WHERE api_key = ?').get(apiKey) as User | undefined;
    return user || null;
  }

  async logout(token: string): Promise<void> {
    await redisService.delete(`${SESSION_PREFIX}${token}`);
  }

  async getUserById(userId: string): Promise<UserResponse | null> {
    const db = getDatabase();
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as User | undefined;

    if (!user) {
      return null;
    }

    return {
      id: user.id,
      username: user.username,
      email: user.email,
      api_key: user.api_key,
      created_at: user.created_at,
    };
  }
}

export const authService = new AuthService();
