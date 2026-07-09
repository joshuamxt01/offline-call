import { Router } from "express";
import { authRouter } from "./modules/auth/auth.routes.js";
import { usersRouter } from "./modules/users/users.routes.js";
import { contactsRouter } from "./modules/contacts/contacts.routes.js";
import { devicesRouter } from "./modules/devices/devices.routes.js";
import { keysRouter } from "./modules/keys/keys.routes.js";
import { conversationsRouter } from "./modules/conversations/conversations.routes.js";
import { messagesRouter } from "./modules/messages/messages.routes.js";
import { callsRouter, turnRouter } from "./modules/calls/calls.routes.js";
import { mediaRouter } from "./modules/media/media.routes.js";
import { networksRouter } from "./modules/networks/networks.routes.js";
import { notificationsRouter } from "./modules/notifications/notifications.routes.js";
import { adminRouter } from "./modules/admin/admin.routes.js";
import { accessRouter } from "./modules/access/access.routes.js";
import { enforceNetworkLock } from "./middleware/networkLock.js";

/** Mounts every feature module under /api/v1. */
export const apiRouter = Router();

// Auth + admin are exempt from the network lock (so users can always log in and
// admins can always manage the lock). Everything else is gated when the lock is on.
apiRouter.use("/auth", authRouter);
apiRouter.use("/admin/access", accessRouter); // before /admin so this matches first
apiRouter.use("/admin", adminRouter);

apiRouter.use("/users", enforceNetworkLock, usersRouter);
apiRouter.use("/contacts", enforceNetworkLock, contactsRouter);
apiRouter.use("/devices", enforceNetworkLock, devicesRouter);
apiRouter.use("/keys", enforceNetworkLock, keysRouter);
apiRouter.use("/conversations", enforceNetworkLock, conversationsRouter);
apiRouter.use("/messages", enforceNetworkLock, messagesRouter);
apiRouter.use("/calls", enforceNetworkLock, callsRouter);
apiRouter.use("/turn", enforceNetworkLock, turnRouter);
apiRouter.use("/media", enforceNetworkLock, mediaRouter);
apiRouter.use("/networks", enforceNetworkLock, networksRouter);
apiRouter.use("/notifications", enforceNetworkLock, notificationsRouter);
