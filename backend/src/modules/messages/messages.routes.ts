import { Router } from "express";
import { z } from "zod";
import { syncPushSchema, ServerEvents } from "@nexa/shared";
import { validate, valid } from "../../middleware/validate.js";
import { requireAuth } from "../../middleware/auth.js";
import { rateLimit } from "../../middleware/rateLimit.js";
import { asyncHandler } from "../../middleware/error.js";
import * as messagesService from "./messages.service.js";
import { emitToUsers } from "../../realtime/emitter.js";
import { memberIds } from "../conversations/conversations.service.js";

export const messagesRouter = Router();
messagesRouter.use(requireAuth);

/** Push queued offline messages in bulk (dedup by ULID id). */
messagesRouter.post(
  "/sync",
  rateLimit({ scope: "messages:syncpush", max: 60, windowSec: 60 }),
  validate(syncPushSchema),
  asyncHandler(async (req, res) => {
    const { messages: batch } = valid<typeof syncPushSchema>(res);
    const { accepted } = await messagesService.syncPush(req.auth!.userId, batch);

    // Fan out accepted messages to recipients that are currently online.
    for (const m of batch.filter((x) => accepted.includes(x.id))) {
      const recipients = (await memberIds(m.conversationId)).filter((r) => r !== req.auth!.userId);
      emitToUsers(recipients, ServerEvents.MessageNew, {
        ...m,
        senderId: req.auth!.userId,
      });
    }
    res.json({ accepted });
  }),
);

const sinceQuery = z.object({ since: z.string().datetime().optional() });

/** Pull messages missed while offline (cursor by server time). */
messagesRouter.get(
  "/sync",
  validate(sinceQuery, "query"),
  asyncHandler(async (req, res) => {
    const { since } = valid<typeof sinceQuery>(res, "query");
    res.json({ data: await messagesService.syncPull(req.auth!.userId, since) });
  }),
);
