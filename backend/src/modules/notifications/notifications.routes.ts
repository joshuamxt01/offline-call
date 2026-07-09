import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import { asyncHandler } from "../../middleware/error.js";
import * as notificationsService from "./notifications.service.js";

export const notificationsRouter = Router();
notificationsRouter.use(requireAuth);

notificationsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const [data, unread] = await Promise.all([
      notificationsService.listFor(req.auth!.userId),
      notificationsService.unreadCount(req.auth!.userId),
    ]);
    res.json({ data, unread });
  }),
);

notificationsRouter.post(
  "/read-all",
  asyncHandler(async (req, res) => {
    await notificationsService.markAllRead(req.auth!.userId);
    res.status(204).end();
  }),
);

notificationsRouter.post(
  "/:id/read",
  asyncHandler(async (req, res) => {
    await notificationsService.markRead(req.auth!.userId, req.params.id!);
    res.status(204).end();
  }),
);
