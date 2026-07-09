import { Router } from "express";
import {
  registerSchema,
  loginSchema,
  refreshSchema,
  verifyDeviceSchema,
} from "@nexa/shared";
import { validate, valid } from "../../middleware/validate.js";
import { requireAuth } from "../../middleware/auth.js";
import { rateLimit } from "../../middleware/rateLimit.js";
import { asyncHandler } from "../../middleware/error.js";
import * as authService from "./auth.service.js";

export const authRouter = Router();

const ipKey = (req: { ip?: string }) => req.ip ?? "anon";

authRouter.post(
  "/register",
  rateLimit({ scope: "auth:register", max: 10, windowSec: 3600, keyBy: ipKey }),
  validate(registerSchema),
  asyncHandler(async (req, res) => {
    const result = await authService.register(valid<typeof registerSchema>(res), { ip: req.ip });
    res.status(201).json(result);
  }),
);

authRouter.post(
  "/login",
  rateLimit({ scope: "auth:login", max: 20, windowSec: 900, keyBy: ipKey }),
  validate(loginSchema),
  asyncHandler(async (req, res) => {
    const result = await authService.login(valid<typeof loginSchema>(res), { ip: req.ip });
    res.json(result);
  }),
);

authRouter.post(
  "/refresh",
  rateLimit({ scope: "auth:refresh", max: 60, windowSec: 900, keyBy: ipKey }),
  validate(refreshSchema),
  asyncHandler(async (_req, res) => {
    const { refreshToken } = valid<typeof refreshSchema>(res);
    res.json(await authService.refresh(refreshToken));
  }),
);

authRouter.post(
  "/logout",
  validate(refreshSchema),
  asyncHandler(async (_req, res) => {
    await authService.logout(valid<typeof refreshSchema>(res).refreshToken);
    res.status(204).end();
  }),
);

authRouter.post(
  "/devices/:id/verify",
  requireAuth,
  validate(verifyDeviceSchema),
  asyncHandler(async (req, res) => {
    const { code } = valid<typeof verifyDeviceSchema>(res);
    const device = await authService.verifyDevice(req.auth!.userId, req.params.id!, code);
    res.json({ device });
  }),
);

authRouter.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json(await authService.me(req.auth!.userId, req.auth!.deviceId));
  }),
);
