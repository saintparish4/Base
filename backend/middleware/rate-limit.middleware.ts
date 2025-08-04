import rateLimit from 'express-rate-limit';
import { redisClient } from '../config/redis';
import { logger } from '../utils/logger';

// PAYMENT SPECIFIC RATE LIMITING
export const paymentRateLimit = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 10, // 10 requests per minute
    message: {
        error: 'Too many requests, please try again later.',
        retryAfter: 60, 
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
        // RATE LIMIT BY IP AND USER IF IF AUTHENTICATED
        const ip = req.ip;
        const userId = (req as any).user?.id;
        return userId ? `payment:${userId}` : `payment:${ip}`; 
    }, 
});

// AUTH SPECIFIC RATE LIMITING
export const authRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 requests per 15 minutes
    message: {
        error: 'Too many requests, please try again later.',
        retryAfter: 900, 
    },
    skipSuccessfulRequests: true,
    keyGenerator: (req) => `auth:${req.ip}`, 
});

// WEBHOOK RATE LIMITING
export const webhookRateLimit = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 100, // 100 requests per minute
    message: {
        error: 'Webhook rate limit exceeded, please try again later.', 
    },
    keyGenerator: (req) => `webhook:${req.ip}`,  
});

// CUSTOM REDIS BASED RATE LIMITER FOR MORE COMPLEX SCENARIOS
export class RedisRateLimiter {
    constructor(
        private windowMs: number,
        private maxRequests: number,
        private keyPrefix: string = 'rl',
    ) {}

    async isAllowed(identifier: string): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
        const key = `${this.keyPrefix}:${identifier}`;
        const now = Date.now();
        const windowStart = now - this.windowMs;

        try {
            // REMOVE OLD ENTRIES AND COUNT CURRENT REQUESTS
            await redisClient.zRemRangeByScore(key, 0, windowStart);
            const currentRequests = await redisClient.zCard(key);

            if (currentRequests >= this.maxRequests) {
                const resetTime = await this.getResetTime(key);
                return {
                    allowed: false,
                    remaining: 0,
                    resetTime, 
                }; 
            }

            // ADD CURRENT REQUEST
            await redisClient.zAdd(key, { score: now, value: `${now}-${Math.random()}`});
            await redisClient.expire(key, Math.ceil(this.windowMs / 1000));
            
            return {
                allowed: true,
                remaining: this.maxRequests - currentRequests - 1,
                resetTime: now + this.windowMs, 
            }; 
        } catch (error) {
            logger.error('Redis rate limiter error:', error);
            // FAIL OPEN - ALLOW REQUEST IF REDIS IS DOWN 
            return {
                allowed: true,
                remaining: this.maxRequests - 1,
                resetTime: now + this.windowMs,  
            };
        }
    }

    private async getResetTime(key: string): Promise<number> {
        const oldestRequest = await redisClient.zRange(key, 0, 0, { REV: false } as any);
        if (oldestRequest.length > 0) {
            const timestamp = parseInt(oldestRequest[0].split('-')[0]);
            return timestamp + this.windowMs;
        }
        return Date.now() + this.windowMs;
    }
}