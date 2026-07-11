import { Router } from "express";
import { and, eq, or } from "drizzle-orm";
import { db } from "../../config/db.js";
import { users, mediaObjects, contacts } from "../../db/schema.js";
import { asyncHandler } from "../../middleware/error.js";
import { presignDownload } from "../../config/storage.js";
import { verifyAccessToken } from "../../lib/jwt.js";

/**
 * Avatar redirect. Public by default → any <img>/native loader can use one stable
 * URL: GET /api/v1/users/:id/avatar → 302 to a short-lived presigned image URL.
 * If the owner set their photo to "contacts_only", the viewer must identify
 * themselves with an access token (Authorization header or ?t= query) and be the
 * owner or an accepted contact — otherwise 404 (clients fall back to initials).
 */
export const avatarRouter = Router();

/** Best-effort viewer id from an optional token (header or ?t= query). */
function viewerId(req: { headers: Record<string, unknown>; query: Record<string, unknown> }): string | null {
  const header = req.headers.authorization;
  const bearer = typeof header === "string" && header.startsWith("Bearer ") ? header.slice(7) : null;
  const raw = bearer ?? (typeof req.query.t === "string" ? req.query.t : null);
  if (!raw) return null;
  try {
    return verifyAccessToken(raw).sub;
  } catch {
    return null;
  }
}

avatarRouter.get(
  "/:id/avatar",
  asyncHandler(async (req, res) => {
    const ownerId = req.params.id!;
    const [u] = await db
      .select({ avatarObjectId: users.avatarObjectId, avatarPrivacy: users.avatarPrivacy })
      .from(users)
      .where(eq(users.id, ownerId))
      .limit(1);
    if (!u?.avatarObjectId) return res.status(404).end();

    if (u.avatarPrivacy === "contacts_only") {
      const viewer = viewerId(req);
      let allowed = viewer === ownerId;
      if (!allowed && viewer) {
        const [rel] = await db
          .select({ n: contacts.state })
          .from(contacts)
          .where(
            and(
              eq(contacts.state, "accepted"),
              or(
                and(eq(contacts.ownerId, viewer), eq(contacts.contactUserId, ownerId)),
                and(eq(contacts.ownerId, ownerId), eq(contacts.contactUserId, viewer)),
              ),
            ),
          )
          .limit(1);
        allowed = Boolean(rel);
      }
      if (!allowed) return res.status(404).end();
    }

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
