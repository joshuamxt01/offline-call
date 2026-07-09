import { Router } from "express";
import { userSearchSchema, updateProfileSchema } from "@nexa/shared";
import { validate, valid } from "../../middleware/validate.js";
import { requireAuth } from "../../middleware/auth.js";
import { rateLimit } from "../../middleware/rateLimit.js";
import { asyncHandler } from "../../middleware/error.js";
import * as usersService from "./users.service.js";

export const usersRouter = Router();
usersRouter.use(requireAuth);

usersRouter.get(
  "/search",
  rateLimit({ scope: "users:search", max: 30, windowSec: 60 }),
  validate(userSearchSchema, "query"),
  asyncHandler(async (req, res) => {
    const { q } = valid<typeof userSearchSchema>(res, "query");
    res.json({ data: await usersService.search(q, req.auth!.userId) });
  }),
);

usersRouter.patch(
  "/me",
  validate(updateProfileSchema),
  asyncHandler(async (req, res) => {
    res.json(await usersService.updateProfile(req.auth!.userId, valid<typeof updateProfileSchema>(res)));
  }),
);

usersRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    res.json(await usersService.getPublic(req.params.id!, req.auth!.userId));
  }),
);
