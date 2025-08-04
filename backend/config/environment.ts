import dotenv from 'dotenv';

dotenv.config();

export const config = {
    nodeEnv: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT || '3000', 10),

    // DATABASE
    database: {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432', 10),
        name: process.env.DB_NAME || 'base_db',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'password',
        ssl: process.env.DB_SSL === 'true',
    },

    // REDIS
    redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
        password: process.env.REDIS_PASSWORD || '',
    },

    // JWT
    jwt: {
        secret: process.env.JWT_SECRET || 'your-secret-key',
        expiresIn: process.env.JWT_EXPIRES_IN || '24h',
        refreshSecret: process.env.JWT_REFRESH_SECRET || 'refresh-secret-key',
        refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
    },

    // BLOCKCHAIN
    blockchain: {
        ethereum: process.env.ETHEREUM_RPC_URL || 'https://mainnet.infura.io/v3/your-infura-project-id',
        polygon: process.env.POLYGON_RPC_URL || 'https://polygon-mainnet.infura.io/v3/your-infura-project-id',
        privateKey: process.env.PRIVATE_KEY || '',
        usdcContractAddress: process.env.USDC_CONTRACT_ADDRESS || '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
        gasLimit: parseInt(process.env.GAS_LIMIT || '100000', 10),
    },

    // SECURITY
    encryption: {
        algorithm: 'aes-256-gcm',
        keyLength: 32,
        ivLength: 16,
        saltLength: 64,
        tagLength: 16,
    },

    // EXTERNAL SERVICES
    allowedOrigins: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
    webhookSecret: process.env.WEBHOOK_SECRET || 'your-webhook-secret',

    // KYC Provider
    kyc: {
        apiKey: process.env.KYC_API_KEY || '',
        baseUrl: process.env.KYC_BASE_URL || 'https://api.kyc-provider.com',
    },
};