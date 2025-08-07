import { Router } from "express";
import { body } from "express-validator";
import { AuthController } from "../controllers/auth.controller";
import { authRateLimit } from "../middleware/rate-limit.middleware";
import { asyncHandler } from "../middleware/error.middleware";

const router = Router();
const authController = new AuthController();

// APPLY RATE LIMITING TO AUTH ROUTES
router.use(authRateLimit);

// REGISTER MERCHANT
router.post(
  "/register",
  [
    body("email").isEmail().normalizeEmail(),
    body("password")
      .isLength({ min: 8 })
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/),
    body("businessName").isLength({ min: 2, max: 100 }).trim(),
    body("contactPhone").optional().isMobilePhone("any"),
  ],
  asyncHandler(authController.register.bind(authController))
);

// LOGIN MERCHANT
router.post(
  "/login",
  [body("email").isEmail().normalizeEmail(), body("password").notEmpty()],
  asyncHandler(authController.login.bind(authController))
);

// REFRESH TOKEN
router.post(
  "/refresh",
  [body("refreshToken").notEmpty()],
  asyncHandler(authController.refreshToken.bind(authController))
);

// LOGOUT
router.post(
  "/logout",
  asyncHandler(authController.logout.bind(authController))
);

// REQUEST PASSWORD RESET
router.post(
  "/forgot-password",
  [body("email").isEmail().normalizeEmail()],
  asyncHandler(authController.forgotPassword.bind(authController))
);

// RESET PASSWORD
router.post(
  "/reset-password",
  [
    body("token").notEmpty(),
    body("newPassword")
      .isLength({ min: 8 })
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/),
  ],
  asyncHandler(authController.resetPassword.bind(authController))
);

export default router;
