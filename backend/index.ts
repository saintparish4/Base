import express from "express";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { config } from
import { logger } from "./utils/logger";
import { errorHandler } from "./middlewares/error.middleware";
import { loggingMiddleware } from "./middlewares/logging.middleware";
import routes from "./routes";
import { connectDatabase } from "./database/connection";
import { connectRedis } from "./config/redis";

const app = express();

// Security middleware
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", "data:", "https:"], 
        },
    },
}));

app.use(cors({
    origin: config.allowedOrigins,
    credentials: true, 
}));

// Rate Limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: "Too many requests, please try again later.",
    standardHeaders: true,
    legacyHeaders: false, 
});

app.use('/api', limiter);

// Body Parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Logging
app.use(loggingMiddleware);

// Health Check
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || '1.0.0'
    });
});

// API Routes
app.use('/api', routes);

// Error Handling
app.use(errorHandler);

// Initialize connections and start server
async function startServer() {
    try {
        await connectDatabase();
        await connectRedis();

        const port = config.port;
        app.listen(port, () => {
            logger.info(` Base Server is running on port ${port}`);
            logger.info(`Environment: ${config.nodeEnv}`); 
        });
    } catch (error) {
        logger.error('Failed to start server', error);
        process.exit(1);
    }
}