import { Router } from "express";
import { eq } from "drizzle-orm";
import { db } from "../../config/db.js";
import { users, mediaObjects } from "../../db/schema.js";
import { asyncHandler } from "../../middleware/error.js";
import { presignDownload } from "../../config/storage.js";

/**
 * PUBLIC avatar redirect. Profile pictures aren't secret, so this needs no auth —
 * that lets plain <img> tags and native image loaders use one stable URL:
 *   GET /api/v1/users/:id/avatar  -> 302 to a short-lived presigned image URL
 * Returns 404 when the user has no avatar (clients fall back to initials).
 */
export const avatarRouter = Router();

avatarRouter.get(
  "/:id/avatar",
  asyncHandler(async (req, res) => {
    const [u] = await db
      .select({ avatarObjectId: users.avatarObjectId })
      .from(users)
      .where(eq(users.id, req.params.id!))
      .limit(1);
    if (!u?.avatarObjectId) return res.status(404).end();

    const [obj] = await db
      .select({ bucketKey: mediaObjects.bucketKey })
      .from(mediaObjects)
      .where(eq(mediaObjects.id, u.avatarObjectId))
      .limit(1);
    if (!obj) return res.status(404).end();

    const url = await presignDownload(obj.bucketKey);
    res.redirect(302, url);
  }),
);
