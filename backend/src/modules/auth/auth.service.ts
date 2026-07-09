import { and, eq, lt } from "drizzle-orm";
import { db } from "../../config/db.js";
import { users, devices, deviceKeys, refreshTokens } from "../../db/schema.js";
import { hashPassword, verifyPassword } from "../../lib/password.js";
import { signAccessToken } from "../../lib/jwt.js";
import { opaqueToken, sha256, verifyCode, uuid } from "../../lib/ids.js";
import { env, isProd } from "../../config/env.js";
import { Errors } from "../../lib/http-error.js";
import { toUserPrivate, toDeviceDto } from "../../lib/mappers.js";
import { audit } from "../admin/audit.service.js";
import { partitionForIp, isLockEnabled, ONLINE_PARTITION } from "../access/access.service.js";
import type { AuthResult, Platform } from "@nexa/shared";
import type { RegisterInput, LoginInput } from "@nexa/shared";

interface Ctx {
  ip?: string;
}

async function issueTokens(userId: string, deviceId: string, role: "user" | "admin") {
  const accessToken = signAccessToken({ sub: userId, did: deviceId, role });
  const rawRefresh = opaqueToken();
  const familyId = uuid();
  await db.insert(refreshTokens).values({
    deviceId,
    tokenHash: sha256(rawRefresh),
    familyId,
    expiresAt: new Date(Date.now() + env.REFRESH_TOKEN_TTL * 1000),
  });
  return { accessToken, refreshToken: rawRefresh };
}

async function rotateWithinFamily(familyId: string, deviceId: string, role: "user" | "admin", userId: string) {
  const accessToken = signAccessToken({ sub: userId, did: deviceId, role });
  const rawRefresh = opaqueToken();
  await db.insert(refreshTokens).values({
    deviceId,
    tokenHash: sha256(rawRefresh),
    familyId,
    expiresAt: new Date(Date.now() + env.REFRESH_TOKEN_TTL * 1000),
  });
  return { accessToken, refreshToken: rawRefresh };
}

export async function register(input: RegisterInput, ctx: Ctx): Promise<AuthResult & { devVerifyCode?: string }> {
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, input.email))
    .limit(1);
  if (existing.length) throw Errors.conflict("Email already registered");

  const usernameTaken = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, input.username))
    .limit(1);
  if (usernameTaken.length) throw Errors.conflict("Username taken");

  const passwordHash = await hashPassword(input.password);

  // Tag the account with the network it's created on (an approved office Wi-Fi's
  // id, or "online"). This partitions who they can later see/contact.
  const partition = await partitionForIp(ctx.ip ?? "");

  const [user] = await db
    .insert(users)
    .values({
      username: input.username,
      email: input.email,
      passwordHash,
      displayName: input.username,
      networkPartition: partition,
    })
    .returning();
  if (!user) throw Errors.internal("Failed to create user");

  // The registering device is trusted (verified) at account creation.
  const [device] = await db
    .insert(devices)
    .values({
      userId: user.id,
      deviceName: input.deviceName ?? "Primary device",
      platform: input.platform as Platform,
      verified: true,
    })
    .returning();
  if (!device) throw Errors.internal("Failed to register device");

  if (input.identityPub) {
    await db.insert(deviceKeys).values({
      deviceId: device.id,
      identityPub: Buffer.from(input.identityPub, "base64"),
    });
  }

  await audit(user.id, "auth.register", user.id, ctx.ip);
  const tokens = await issueTokens(user.id, device.id, "user");
  return { user: toUserPrivate(user), device: toDeviceDto(device), ...tokens };
}

export async function login(input: LoginInput, ctx: Ctx): Promise<AuthResult & { devVerifyCode?: string }> {
  const [user] = await db
    .select()
    .from(users)
    .where(
      input.emailOrUsername.includes("@")
        ? eq(users.email, input.emailOrUsername)
        : eq(users.username, input.emailOrUsername),
    )
    .limit(1);

  // Constant-ish response to avoid user enumeration.
  if (!user || user.status !== "active") throw Errors.unauthenticated("Invalid credentials");
  const ok = await verifyPassword(user.passwordHash, input.password);
  if (!ok) throw Errors.unauthenticated("Invalid credentials");

  // Network gating: when the lock is on, an account can only be used on the
  // network it was created on. Admins are exempt so they can always manage.
  if (user.role !== "admin" && (await isLockEnabled())) {
    const current = await partitionForIp(ctx.ip ?? "");
    const accountPartition = user.networkPartition ?? ONLINE_PARTITION;
    if (current !== accountPartition) {
      const onOffice = current !== ONLINE_PARTITION;
      throw Errors.forbidden(
        onOffice
          ? "This account can't be used on this Wi-Fi. On this network you must create and use an account registered here."
          : "This account only works on its office Wi-Fi. Connect to that network to log in.",
      );
    }
  }

  // Each login provisions a device (new devices must be verified).
  const code = verifyCode();
  const [device] = await db
    .insert(devices)
    .values({
      userId: user.id,
      deviceName: input.deviceName ?? "New device",
      platform: input.platform as Platform,
      verified: false,
      verifyCode: code,
    })
    .returning();
  if (!device) throw Errors.internal("Failed to register device");

  if (input.identityPub) {
    await db.insert(deviceKeys).values({
      deviceId: device.id,
      identityPub: Buffer.from(input.identityPub, "base64"),
    });
  }

  await audit(user.id, "auth.login", device.id, ctx.ip);
  const tokens = await issueTokens(user.id, device.id, user.role as "user" | "admin");
  return {
    user: toUserPrivate(user),
    device: toDeviceDto(device),
    ...tokens,
    // In production, the code is delivered out-of-band (push to a verified device/email).
    devVerifyCode: isProd ? undefined : code,
  };
}

export async function refresh(rawRefresh: string) {
  const tokenHash = sha256(rawRefresh);
  const [row] = await db
    .select()
    .from(refreshTokens)
    .where(eq(refreshTokens.tokenHash, tokenHash))
    .limit(1);

  if (!row) throw Errors.unauthenticated("Invalid refresh token");

  // Reuse detection: a token that was already rotated is being replayed.
  if (row.used) {
    await db.delete(refreshTokens).where(eq(refreshTokens.familyId, row.familyId));
    throw Errors.tokenReuse();
  }
  if (row.expiresAt.getTime() < Date.now()) {
    throw Errors.unauthenticated("Refresh token expired");
  }

  // Look up device + user role for the new access token.
  const [device] = await db.select().from(devices).where(eq(devices.id, row.deviceId)).limit(1);
  if (!device) throw Errors.unauthenticated("Device revoked");
  const [user] = await db.select().from(users).where(eq(users.id, device.userId)).limit(1);
  if (!user || user.status !== "active") throw Errors.unauthenticated("Account inactive");

  await db.update(refreshTokens).set({ used: true }).where(eq(refreshTokens.id, row.id));
  return rotateWithinFamily(row.familyId, device.id, user.role as "user" | "admin", user.id);
}

export async function logout(rawRefresh: string): Promise<void> {
  const tokenHash = sha256(rawRefresh);
  const [row] = await db
    .select({ familyId: refreshTokens.familyId })
    .from(refreshTokens)
    .where(eq(refreshTokens.tokenHash, tokenHash))
    .limit(1);
  if (row) await db.delete(refreshTokens).where(eq(refreshTokens.familyId, row.familyId));
}

export async function verifyDevice(userId: string, deviceId: string, code: string) {
  const [device] = await db
    .select()
    .from(devices)
    .where(and(eq(devices.id, deviceId), eq(devices.userId, userId)))
    .limit(1);
  if (!device) throw Errors.notFound("Device not found");
  if (device.verified) return toDeviceDto(device);
  if (device.verifyCode !== code) throw Errors.forbidden("Incorrect verification code");

  const [updated] = await db
    .update(devices)
    .set({ verified: true, verifyCode: null })
    .where(eq(devices.id, deviceId))
    .returning();
  await audit(userId, "device.verify", deviceId);
  return toDeviceDto(updated!);
}

export async function me(userId: string, deviceId: string) {
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  const [device] = await db.select().from(devices).where(eq(devices.id, deviceId)).limit(1);
  if (!user || !device) throw Errors.unauthenticated();
  return { user: toUserPrivate(user), device: toDeviceDto(device) };
}

/** Housekeeping — purge expired refresh tokens (call from a cron/interval). */
export async function purgeExpiredTokens(): Promise<void> {
  await db.delete(refreshTokens).where(lt(refreshTokens.expiresAt, new Date()));
}
