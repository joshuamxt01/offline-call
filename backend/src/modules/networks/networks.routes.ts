import { Router } from "express";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { createNetworkSchema } from "@nexa/shared";
import { db } from "../../config/db.js";
import { networks } from "../../db/schema.js";
import { validate, valid } from "../../middleware/validate.js";
import { requireAuth } from "../../middleware/auth.js";
import { asyncHandler } from "../../middleware/error.js";
import { Errors } from "../../lib/http-error.js";

export const networksRouter = Router();
networksRouter.use(requireAuth);

networksRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const rows = await db.select().from(networks).where(eq(networks.ownerId, req.auth!.userId));
    res.json({ data: rows });
  }),
);

networksRouter.post(
  "/",
  validate(createNetworkSchema),
  asyncHandler(async (req, res) => {
    const input = valid<typeof createNetworkSchema>(res);
    const [row] = await db
      .insert(networks)
      .values({
        ownerId: req.auth!.userId,
        ssidHash: input.ssidHash,
        bssidHash: input.bssidHash ?? null,
        localIdentifier: input.localIdentifier,
        label: input.label,
        permissions: input.permissions ?? {},
        approved: false, // user/admin must approve before it enables discovery
      })
      .returning();
    res.status(201).json(row);
  }),
);

const patchSchema = z.object({
  approved: z.boolean().optional(),
  label: z.string().max(80).optional(),
  permissions: z.record(z.unknown()).optional(),
});

networksRouter.patch(
  "/:id",
  validate(patchSchema),
  asyncHandler(async (req, res) => {
    const patch = valid<typeof patchSchema>(res);
    const [row] = await db
      .update(networks)
      .set(patch)
      .where(and(eq(networks.id, req.params.id!), eq(networks.ownerId, req.auth!.userId)))
      .returning();
    if (!row) throw Errors.notFound("Network not found");
    res.json(row);
  }),
);

networksRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const result = await db
      .delete(networks)
      .where(and(eq(networks.id, req.params.id!), eq(networks.ownerId, req.auth!.userId)))
      .returning({ id: networks.id });
    if (!result.length) throw Errors.notFound("Network not found");
    res.status(204).end();
  }),
);
