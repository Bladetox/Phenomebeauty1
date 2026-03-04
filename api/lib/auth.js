// api/lib/auth.js — Enhanced authentication and authorization middleware
'use strict';

const crypto = require('crypto');

// Token secret validation
const ADMIN_TOKEN_SECRET = (() => {
  const s = process.env.ADMIN_TOKEN_SECRET;
  if (!s) {
    throw new Error('ADMIN_TOKEN_SECRET environment variable is required');
  }
  if (s.length < 32) {
    throw new Error('ADMIN_TOKEN_SECRET must be at least 32 characters');
  }
  return s;
})();

/**
 * Generate a secure HMAC-SHA256 token from password
 * @param {string} password - Admin password
 * @returns {string} - 64-character hex token
 */
function makeAdminToken(password) {
  if (!password || typeof password !== 'string') {
    throw new Error('Password must be a non-empty string');
  }
  return crypto
    .createHmac('sha256', ADMIN_TOKEN_SECRET)
    .update(password)
    .digest('hex');
}

/**
 * Validate admin token against stored password using timing-safe comparison
 * @param {string} token - Token from request header
 * @param {string} expectedPassword - Password from settings
 * @returns {boolean} - True if token is valid
 */
function validateAdminToken(token, expectedPassword) {
  if (!token || !expectedPassword) return false;
  
  // Token must be exactly 64 hex characters
  if (token.length !== 64 || !/^[0-9a-f]{64}$/i.test(token)) {
    return false;
  }
  
  try {
    const expected = makeAdminToken(expectedPassword);
    
    // Pad both to prevent length-based timing attacks
    const tokenBuf = Buffer.from(token.padEnd(64, '0'));
    const expectedBuf = Buffer.from(expected.padEnd(64, '0'));
    
    return crypto.timingSafeEqual(tokenBuf, expectedBuf);
  } catch (error) {
    console.error('Token validation error:', error.message);
    return false;
  }
}

/**
 * Express middleware: Require valid admin authentication
 * Attaches doc and settings to req object on success
 * 
 * Usage:
 *   app.get('/api/admin/bookings', requireAdmin, handler);
 */
async function requireAdmin(req, res, next) {
  // Extract token from header
  const authHeader = req.headers['authorization'] || req.headers['x-admin-token'] || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  
  if (!token) {
    return res.status(401).json({
      error: 'Authentication required',
      code: 'MISSING_TOKEN'
    });
  }
  
  try {
    // Get settings from sheet (imported from sheet.js)
    const { getDoc, getSettings } = require('./sheet');
    const doc = await getDoc();
    const settings = await getSettings(doc);
    
    // Validate token
    const isValid = validateAdminToken(token, settings.admin_password || '');
    
    if (!isValid) {
      // Add delay to prevent brute force
      await new Promise(resolve => setTimeout(resolve, 500));
      
      return res.status(401).json({
        error: 'Invalid credentials',
        code: 'INVALID_TOKEN'
      });
    }
    
    // Attach to request for downstream handlers
    req.doc = doc;
    req.settings = settings;
    req.isAdmin = true;
    
    next();
    
  } catch (error) {
    console.error('Admin auth error:', error.message);
    return res.status(500).json({
      error: 'Authentication service unavailable',
      code: 'AUTH_ERROR'
    });
  }
}

/**
 * Rate limiter for login attempts
 * Tracks failed attempts per IP with exponential backoff
 */
class LoginRateLimiter {
  constructor() {
    this.attempts = new Map();
    
    // Cleanup old entries every 10 minutes
    setInterval(() => {
      const now = Date.now();
      for (const [ip, data] of this.attempts.entries()) {
        if (now - data.lastAttempt > 10 * 60 * 1000) {
          this.attempts.delete(ip);
        }
      }
    }, 10 * 60 * 1000).unref();
  }
  
  /**
   * Check if IP is currently rate limited
   * @param {string} ip - Client IP address
   * @returns {object} - {allowed: boolean, retryAfter: number}
   */
  check(ip) {
    const now = Date.now();
    const data = this.attempts.get(ip) || { count: 0, lastAttempt: now };
    
    // Reset after 15 minutes
    if (now - data.lastAttempt > 15 * 60 * 1000) {
      this.attempts.delete(ip);
      return { allowed: true, retryAfter: 0 };
    }
    
    // Exponential backoff: 5 attempts = 5s, 10 = 1min, 15 = 5min
    const delays = [0, 0, 0, 1000, 2000, 5000, 10000, 30000, 60000, 120000, 300000];
    const delay = delays[Math.min(data.count, delays.length - 1)] || 300000;
    
    const waitTime = delay - (now - data.lastAttempt);
    
    if (waitTime > 0) {
      return {
        allowed: false,
        retryAfter: Math.ceil(waitTime / 1000)
      };
    }
    
    return { allowed: true, retryAfter: 0 };
  }
  
  /**
   * Record failed login attempt
   * @param {string} ip - Client IP address
   */
  recordFailure(ip) {
    const now = Date.now();
    const data = this.attempts.get(ip) || { count: 0, lastAttempt: now };
    
    data.count++;
    data.lastAttempt = now;
    this.attempts.set(ip, data);
  }
  
  /**
   * Reset attempts for IP on successful login
   * @param {string} ip - Client IP address
   */
  reset(ip) {
    this.attempts.delete(ip);
  }
}

const loginLimiter = new LoginRateLimiter();

/**
 * Get client IP from request, handling proxies
 * @param {object} req - Express request object
 * @returns {string} - Client IP address
 */
function getClientIP(req) {
  return (
    req.headers['x-real-ip'] ||
    req.headers['x-forwarded-for']?.split(',')[0].trim() ||
    req.ip ||
    req.connection?.remoteAddress ||
    'unknown'
  );
}

module.exports = {
  makeAdminToken,
  validateAdminToken,
  requireAdmin,
  loginLimiter,
  getClientIP,
  ADMIN_TOKEN_SECRET,
};
