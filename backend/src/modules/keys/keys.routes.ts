import { Router } from "express";
import { eq, desc } from "drizzle-orm";
import { db } from "../../config/db.js";
import { deviceKeys, devices } from "../../db/schema.js";
import { prekeyReplenishSchema } from "@nexa/shared";
import { validate, valid } from "../../middleware/validate.js";
import { requireAuth } from "../../middleware/auth.js";
import { asyncHandler } from "../../middleware/error.js";
import { Errors } from "../../lib/http-error.js";
import type { PublicKeyBundle } from "@nexa/shared";

export const keysRouter = Router();
keysRouter.use(requireAuth);

/**
 * Fetch a user's key bundle to establish an E2EE session (X3DH-lite).
 * Consumes one one-time prekey atomically-ish (pop from jsonb array).
 */
keysRouter.get(
  "/:userId",
  asyncHandler(async (req, res) => {
    const [row] = await db
      .select({ key: deviceKeys, deviceId: devices.id })
      .from(deviceKeys)
      .innerJoin(devices, eq(devices.id, deviceKeys.deviceId))
      .where(eq(devices.userId, req.params.userId!))
      .orderBy(desc(deviceKeys.createdAt))
      .limit(1);

    if (!row) throw Errors.notFound("No keys published for user");

    const prekeys = (row.key.oneTimePrekeys as string[]) ?? [];
    const oneTime = prekeys.length ? prekeys[0]! : null;
    if (oneTime) {
      await db
        .update(deviceKeys)
        .set({ oneTimePrekeys: prekeys.slice(1) })
        .where(eq(deviceKeys.id, row.key.id));
    }

    const bundle: PublicKeyBundle = {
      userId: req.params.userId!,
      deviceId: row.deviceId,
      identityPub: Buffer.from(row.key.identityPub).toString("base64"),
      signedPrekey: row.key.signedPrekey ? Buffer.from(row.key.signedPrekey).toString("base64") : "",
      signedPrekeySig: row.key.signedPrekeySig
        ? Buffer.from(row.key.signedPrekeySig).toString("base64")
        : "",
      oneTimePrekey: oneTime,
      algo: row.key.algo,
    };
    res.json(bundle);
  }),
);

/** Replenish my device's one-time prekey pool. */
keysRouter.post(
  "/prekeys",
  validate(prekeyReplenishSchema),
  asyncHandler(async (req, res) => {
    const { oneTimePrekeys } = valid<typeof prekeyReplenishSchema>(res);
    const [row] = await db
      .select()
      .from(deviceKeys)
      .where(eq(deviceKeys.deviceId, req.auth!.deviceId))
      .limit(1);
    if (!row) throw Errors.notFound("Device has no key record");

    const merged = [...((row.oneTimePrekeys as string[]) ?? []), ...oneTimePrekeys].slice(0, 200);
    await db.update(deviceKeys).set({ oneTimePrekeys: merged }).where(eq(deviceKeys.id, row.id));
    res.json({ count: merged.length });
  }),
);
