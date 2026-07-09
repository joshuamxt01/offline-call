import { Router } from "express";
import { z } from "zod";
import { validate, valid } from "../../middleware/validate.js";
import { requireAuth } from "../../middleware/auth.js";
import { requireRole } from "../../middleware/rbac.js";
import { asyncHandler } from "../../middleware/error.js";
import { audit } from "../admin/audit.service.js";
import * as access from "./access.service.js";

/** Admin-only management of the network access lock. Mounted at /admin/access. */
export const accessRouter = Router();
accessRouter.use(requireAuth, requireRole("admin"));

accessRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    res.json({
      enabled: await access.isLockEnabled(),
      networks: await access.listNetworks(),
      yourIp: access.normalizeIp(req.ip), // so the admin can add their current network
    });
  }),
);

const lockSchema = z.object({ enabled: z.boolean() });
accessRouter.post(
  "/lock",
  validate(lockSchema),
  asyncHandler(async (req, res) => {
    const { enabled } = valid<typeof lockSchema>(res);
    await access.setLockEnabled(enabled);
    await audit(req.auth!.userId, enabled ? "access.lock_on" : "access.lock_off", undefined, req.ip);
    res.json({ enabled });
  }),
);

const netSchema = z.object({
  cidr: z.string().min(7).max(43).regex(/^\d{1,3}(\.\d{1,3}){3}(\/\d{1,2})?$/, "IPv4 or CIDR, e.g. 192.168.1.0/24"),
  label: z.string().max(80).optional(),
});
accessRouter.post(
  "/networks",
  validate(netSchema),
  asyncHandler(async (req, res) => {
    const { cidr, label } = valid<typeof netSchema>(res);
    const row = await access.addNetwork(cidr, label ?? null, req.auth!.userId);
    await audit(req.auth!.userId, "access.network_add", cidr, req.ip);
    res.status(201).json(row);
  }),
);

accessRouter.delete(
  "/networks/:id",
  asyncHandler(async (req, res) => {
    await access.removeNetwork(req.params.id!);
    await audit(req.auth!.userId, "access.network_remove", req.params.id, req.ip);
    res.status(204).end();
  }),
);
