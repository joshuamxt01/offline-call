import { Router } from "express";
import { z } from "zod";
import { createContactSchema, updateContactSchema } from "@nexa/shared";
import { validate, valid } from "../../middleware/validate.js";
import { requireAuth } from "../../middleware/auth.js";
import { rateLimit } from "../../middleware/rateLimit.js";
import { asyncHandler } from "../../middleware/error.js";
import * as contactsService from "./contacts.service.js";

export const contactsRouter = Router();
contactsRouter.use(requireAuth);

contactsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    res.json({ data: await contactsService.list(req.auth!.userId) });
  }),
);

contactsRouter.post(
  "/",
  rateLimit({ scope: "contacts:create", max: 30, windowSec: 3600 }),
  validate(createContactSchema),
  asyncHandler(async (req, res) => {
    const { contactUserId } = valid<typeof createContactSchema>(res);
    res.status(201).json(await contactsService.create(req.auth!.userId, contactUserId));
  }),
);

/** Accept or reject an incoming request. */
const respondSchema = z.object({ accept: z.boolean() });
contactsRouter.post(
  "/:id/respond",
  validate(respondSchema),
  asyncHandler(async (req, res) => {
    const { accept } = valid<typeof respondSchema>(res);
    res.json(await contactsService.respond(req.auth!.userId, req.params.id!, accept));
  }),
);

/** Cancel my outgoing pending request. */
contactsRouter.post(
  "/:id/cancel",
  asyncHandler(async (req, res) => {
    await contactsService.cancel(req.auth!.userId, req.params.id!);
    res.status(204).end();
  }),
);

/** Block / unblock a user by userId. */
const blockSchema = z.object({ userId: z.string().uuid() });
contactsRouter.post(
  "/block",
  validate(blockSchema),
  asyncHandler(async (req, res) => {
    await contactsService.block(req.auth!.userId, valid<typeof blockSchema>(res).userId);
    res.status(204).end();
  }),
);
contactsRouter.post(
  "/unblock",
  validate(blockSchema),
  asyncHandler(async (req, res) => {
    await contactsService.unblock(req.auth!.userId, valid<typeof blockSchema>(res).userId);
    res.status(204).end();
  }),
);

/** Update alias / favorite / pinned / state (block via state). */
contactsRouter.patch(
  "/:id",
  validate(updateContactSchema),
  asyncHandler(async (req, res) => {
    res.json(
      await contactsService.update(req.auth!.userId, req.params.id!, valid<typeof updateContactSchema>(res)),
    );
  }),
);

contactsRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    await contactsService.remove(req.auth!.userId, req.params.id!);
    res.status(204).end();
  }),
);
