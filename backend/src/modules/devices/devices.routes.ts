import { Router } from "express";
import { and, eq } from "drizzle-orm";
import { db } from "../../config/db.js";
import { devices } from "../../db/schema.js";
import { requireAuth } from "../../middleware/auth.js";
import { asyncHandler } from "../../middleware/error.js";
import { Errors } from "../../lib/http-error.js";
import { toDeviceDto } from "../../lib/mappers.js";
import { audit } from "../admin/audit.service.js";

export const devicesRouter = Router();
devicesRouter.use(requireAuth);

devicesRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const rows = await db.select().from(devices).where(eq(devices.userId, req.auth!.userId));
    res.json({ data: rows.map(toDeviceDto) });
  }),
);

devicesRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const result = await db
      .delete(devices)
      .where(and(eq(devices.id, req.params.id!), eq(devices.userId, req.auth!.userId)))
      .returning({ id: devices.id });
    if (!result.length) throw Errors.notFound("Device not found");
    await audit(req.auth!.userId, "device.revoke", req.params.id, req.ip);
    res.status(204).end();
  }),
);
