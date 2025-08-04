import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config/environment";
import { logger } from "../utils/logger";

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    merchantId?: string;
  };
}

// JWT AUTHENTICATION MIDDLEWARE
export function authenticateToken(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "Access token required" });
  }

  try {
    const decoded = jwt.verify(token, config.jwt.secret) as any;
    req.user = {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role,
      merchantId: decoded.merchantId,
    };
    next();
  } catch (error) {
    logger.warn("Invalid token attempt:", {
      token: token.substring(0, 10) + "...",
    });
    return res.status(403).json({ error: "Invalid or expired token" });
  }
}

// ROLE BASED AUTHORIZATION MIDDLEWARE
export function authorize(roles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: "Authenticated Required" });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Insufficient permissions" });
    }

    next();
  };
}

// MERCHANT OWNERSHIP MIDDLEWARE
export function requireMerchantOwnership(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  if (!req.user) {
    return res.status(401).json({ error: "Authentication Required" });
  }

  const merchantId = req.params.merchantId || req.query.merchantId;

  if (req.user.role === "admin") {
    return next(); // Admins can access any merchant data
  }

  if (req.user.merchantId !== merchantId) {
    return res
      .status(403)
      .json({ error: "Unauthorized access to merchant data" });
  }

  next();
}

// API KEY AUTHENTICATION FOR EXTERNAL INTEGRATIONS
export function authenticateApiKey(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const apiKey = req.headers["x-api-key"] as string;

  if (!apiKey) {
    return res.status(401).json({ error: "API key required" });
  }

  // IN A REAL IMPLEMENTATION, WILL VALIDATE AGAINST DATABASE
  // FOR NOW, JUST CHECK IF ITS PRESENT AND HAS THE RIGHT FORMAT
  if (!/^cp_[a-zA-Z0-9]{32}$/.test(apiKey)) {
    return res.status(401).json({ error: "Invalid API key format" });
  }

  // TODO: VALIDATE API KEY AGAINST DATABASE AND ATTACH MERCHANT INFO TO REQ.USER
  next();
}
