import { Router } from "express";
import { z } from "zod";
import { createConversationSchema, sendMessageSchema, ServerEvents } from "@nexa/shared";
import { validate, valid } from "../../middleware/validate.js";
import { requireAuth } from "../../middleware/auth.js";
import { rateLimit } from "../../middleware/rateLimit.js";
import { asyncHandler } from "../../middleware/error.js";
import * as conversationsService from "./conversations.service.js";
import * as messagesService from "../messages/messages.service.js";
import { emitToUsers } from "../../realtime/emitter.js";

export const conversationsRouter = Router();
conversationsRouter.use(requireAuth);

conversationsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    res.json({ data: await conversationsService.list(req.auth!.userId) });
  }),
);

conversationsRouter.post(
  "/",
  validate(createConversationSchema),
  asyncHandler(async (req, res) => {
    const { participantId } = valid<typeof createConversationSchema>(res);
    const id = await conversationsService.getOrCreateDirect(req.auth!.userId, participantId);
    res.status(201).json({ id });
  }),
);

const historyQuery = z.object({
  before: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

conversationsRouter.get(
  "/:id/messages",
  validate(historyQuery, "query"),
  asyncHandler(async (req, res) => {
    const { before, limit } = valid<typeof historyQuery>(res, "query");
    const data = await messagesService.history(req.params.id!, req.auth!.userId, before, limit);
    res.json({ data });
  }),
);

/** REST fallback send (used when the socket is unavailable). */
conversationsRouter.post(
  "/:id/messages",
  rateLimit({ scope: "messages:send", max: 240, windowSec: 60 }),
  validate(sendMessageSchema),
  asyncHandler(async (req, res) => {
    const input = valid<typeof sendMessageSchema>(res);
    const { message, recipients } = await messagesService.persist({
      ...input,
      conversationId: req.params.id!,
      senderId: req.auth!.userId,
    });
    emitToUsers(recipients, ServerEvents.MessageNew, message);
    res.status(201).json(message);
  }),
);
