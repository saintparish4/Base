import { Pool } from 'pg';
import { config } from './environment';
import { logger } from '../utils/logger';

export const dbPool = new Pool({
    host: config.database.host,
    port: config.database.port,
    database: config.database.name,
    user: config.database.user,
    password: config.database.password,
    ssl: config.database.ssl ? { rejectUnauthorized: false } : false,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});

dbPool.on('connect', () => {
    logger.info('Connected to PostgreSQL database');
});

dbPool.on('error', (err) => {
    logger.error('Database connection error', err);
});

export default dbPool;