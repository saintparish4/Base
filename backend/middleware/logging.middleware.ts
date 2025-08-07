import { Request, Response, NextFunction } from "express";
import { logger } from "../utils/logger";
import { v4 as uuidv4 } from "uuid";

export interface RequestWithId extends Request {
  requestId: string;
}

export function loggingMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const startTime = Date.now();
  (req as RequestWithId).requestId = uuidv4();

  // LOG REQUEST
  logger.info("Incoming request:", {
    requestId: (req as RequestWithId).requestId,
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get("User-Agent"),
    contentLength: req.get("Content-Length"),
  });

  // LOG RESPONSE
  res.on("finish", () => {
    const duration = Date.now() - startTime;

    logger.info("Request completed:", {
      requestId: (req as RequestWithId).requestId,
      method: req.method,
      url: req.url,
      status: res.statusCode,
      duration: `${duration}ms`,
      contentLength: res.get("Content-Length"),
    });
  });

  next();
}

export function auditLogger(action: string, resource: string) {
  return (req: RequestWithId, res: Response, next: NextFunction) => {
    res.on("finish", () => {
      if (res.statusCode < 400) {
        logger.info("Audit log:", {
          requestId: (req as RequestWithId).requestId,
          action,
          resource,
          userId: (req as any).user?.id,
          ip: req.ip,
          timestamp: new Date().toISOString(),
        });
      }
    });
    next();
  };
}
