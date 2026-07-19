import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import { asyncHandler } from "../../middleware/error.js";

/**
 * TEMPORARY field-diagnostics channel. The app posts its call negotiation log
 * here after each call so we can see exactly why a call did/didn't connect,
 * without needing USB/logcat. In-memory ring buffer (fine for a single instance).
 * Remove once calling is confirmed stable.
 */
type Entry = { at: string; user: string; text: string };
const buffer: Entry[] = [];
const MAX = 300;

export const diagRouter = Router();
diagRouter.use(requireAuth);

diagRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const text = typeof req.body?.text === "string" ? req.body.text.slice(0, 20_000) : "";
    buffer.push({ at: new Date().toISOString(), user: req.auth!.userId, text });
    while (buffer.length > MAX) buffer.shift();
    res.json({ ok: true });
  }),
);

diagRouter.get(
  "/recent",
  asyncHandler(async (req, res) => {
    const n = Math.min(Number(req.query.n) || 20, MAX);
    res.json({ data: buffer.slice(-n) });
  }),
);
