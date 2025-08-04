import { createClient } from 'redis';
import { config } from './environment';
import { logger } from '../utils/logger';

export const redisClient = createClient({
    socket: {
        host: config.redis.host,
        port: config.redis.port,
    },
    password: config.redis.password,
});

redisClient.on('connect', () => {
    logger.info('Connected to Redis');
});

redisClient.on('error', (err) => {
    logger.error('Redis connection error', err);
});

export async function connectRedis() {
    try {
        await redisClient.connect(); 
    } catch (error) {
        logger.error('Failed to connect to Redis', error);
        throw error;
    }
}

export default redisClient;

