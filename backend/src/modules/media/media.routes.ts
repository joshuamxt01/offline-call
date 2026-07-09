import { Router } from "express";
import { and, eq, sql } from "drizzle-orm";
import { uploadUrlSchema } from "@nexa/shared";
import { db } from "../../config/db.js";
import { mediaObjects, messages, conversationMembers } from "../../db/schema.js";
import { validate, valid } from "../../middleware/validate.js";
import { requireAuth } from "../../middleware/auth.js";
import { rateLimit } from "../../middleware/rateLimit.js";
import { asyncHandler } from "../../middleware/error.js";
import { Errors } from "../../lib/http-error.js";
import { presignUpload, presignDownload } from "../../config/storage.js";
import { uuid } from "../../lib/ids.js";

export const mediaRouter = Router();
mediaRouter.use(requireAuth);

/** Step 1: reserve an object + get a presigned PUT URL. */
mediaRouter.post(
  "/upload-url",
  rateLimit({ scope: "media:upload", max: 60, windowSec: 60 }),
  validate(uploadUrlSchema),
  asyncHandler(async (req, res) => {
    const input = valid<typeof uploadUrlSchema>(res);
    const objectId = uuid();
    const bucketKey = `${input.kind}/${req.auth!.userId}/${objectId}`;
    await db.insert(mediaObjects).values({
      id: objectId,
      ownerId: req.auth!.userId,
      kind: input.kind,
      bucketKey,
      contentType: input.contentType,
      sizeBytes: input.sizeBytes,
      durationMs: input.durationMs ?? null,
      committed: false,
    });
    const uploadUrl = await presignUpload(bucketKey, input.contentType);
    res.status(201).json({ objectId, uploadUrl, method: "PUT", headers: { "Content-Type": input.contentType } });
  }),
);

/** Step 2: confirm the client finished uploading. */
mediaRouter.post(
  "/:objectId/commit",
  asyncHandler(async (req, res) => {
    const [row] = await db
      .update(mediaObjects)
      .set({ committed: true })
      .where(and(eq(mediaObjects.id, req.params.objectId!), eq(mediaObjects.ownerId, req.auth!.userId)))
      .returning();
    if (!row) throw Errors.notFound("Media object not found");
    res.json({ objectId: row.id, committed: true });
  }),
);

/** Step 3: get a short-lived presigned GET URL (owner or conversation member). */
mediaRouter.get(
  "/:objectId/download-url",
  asyncHandler(async (req, res) => {
    const [obj] = await db
      .select()
      .from(mediaObjects)
      .where(eq(mediaObjects.id, req.params.objectId!))
      .limit(1);
    if (!obj) throw Errors.notFound("Media object not found");

    let authorized = obj.ownerId === req.auth!.userId;
    if (!authorized) {
      // Allowed if the media is attached to a message in a conversation the user belongs to.
      const [shared] = await db
        .select({ n: sql<number>`1` })
        .from(messages)
        .innerJoin(
          conversationMembers,
          eq(conversationMembers.conversationId, messages.conversationId),
        )
        .where(
          and(
            eq(messages.mediaObjectId, obj.id),
            eq(conversationMembers.userId, req.auth!.userId),
          ),
        )
        .limit(1);
      authorized = Boolean(shared);
    }
    if (!authorized) throw Errors.forbidden();

    const url = await presignDownload(obj.bucketKey);
    res.json({ url, contentType: obj.contentType, expiresIn: 900 });
  }),
);
