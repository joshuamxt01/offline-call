import { Router } from "express";
import { z } from "zod";
import { validate, valid } from "../../middleware/validate.js";
import { requireAuth } from "../../middleware/auth.js";
import { rateLimit } from "../../middleware/rateLimit.js";
import { asyncHandler } from "../../middleware/error.js";
import * as callsService from "./calls.service.js";
import { issueTurnCredentials } from "../../lib/turn.js";

export const callsRouter = Router();
callsRouter.use(requireAuth);

const listQuery = z.object({
  before: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

callsRouter.get(
  "/",
  validate(listQuery, "query"),
  asyncHandler(async (req, res) => {
    const { before, limit } = valid<typeof listQuery>(res, "query");
    res.json({ data: await callsService.history(req.auth!.userId, before, limit) });
  }),
);

callsRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    res.json(await callsService.getById(req.auth!.userId, req.params.id!));
  }),
);

/** Short-lived HMAC TURN credentials (used only for online P2P fallback). */
export const turnRouter = Router();
turnRouter.use(requireAuth);
turnRouter.get(
  "/credentials",
  rateLimit({ scope: "turn:creds", max: 60, windowSec: 60 }),
  asyncHandler(async (req, res) => {
    res.json(issueTurnCredentials(req.auth!.userId, Math.floor(Date.now() / 1000)));
  }),
);
