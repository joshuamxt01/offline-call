import { Router } from "express";
import { z } from "zod";
import { validate, valid } from "../../middleware/validate.js";
import { requireAuth } from "../../middleware/auth.js";
import { requireRole } from "../../middleware/rbac.js";
import { asyncHandler } from "../../middleware/error.js";
import * as adminService from "./admin.service.js";
import { audit } from "./audit.service.js";

export const adminRouter = Router();
adminRouter.use(requireAuth, requireRole("admin"));

const userListQuery = z.object({
  q: z.string().max(64).optional(),
  status: z.enum(["active", "suspended", "deleted"]).optional(),
});

adminRouter.get(
  "/users",
  validate(userListQuery, "query"),
  asyncHandler(async (_req, res) => {
    const { q, status } = valid<typeof userListQuery>(res, "query");
    res.json({ data: await adminService.listUsers(q, status) });
  }),
);

const userPatchSchema = z.object({
  status: z.enum(["active", "suspended", "deleted"]).optional(),
  role: z.enum(["user", "admin"]).optional(),
});

adminRouter.patch(
  "/users/:id",
  validate(userPatchSchema),
  asyncHandler(async (req, res) => {
    const patch = valid<typeof userPatchSchema>(res);
    const user = await adminService.updateUser(req.params.id!, patch);
    await audit(req.auth!.userId, "admin.update_user", req.params.id, req.ip, patch);
    res.json(user);
  }),
);

adminRouter.get(
  "/devices",
  asyncHandler(async (_req, res) => {
    res.json({ data: await adminService.listDevices() });
  }),
);

adminRouter.get(
  "/networks",
  asyncHandler(async (_req, res) => {
    res.json({ data: await adminService.listNetworks() });
  }),
);

adminRouter.get(
  "/stats",
  asyncHandler(async (_req, res) => {
    res.json(await adminService.stats());
  }),
);

const callQuery = z.object({
  before: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

adminRouter.get(
  "/calls",
  validate(callQuery, "query"),
  asyncHandler(async (_req, res) => {
    const { before, limit } = valid<typeof callQuery>(res, "query");
    res.json({ data: await adminService.callLog(before, limit) });
  }),
);

adminRouter.get(
  "/audit",
  asyncHandler(async (_req, res) => {
    res.json({ data: await adminService.audit() });
  }),
);
