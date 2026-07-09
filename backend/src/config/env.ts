import { config as loadEnv } from "dotenv";
import { z } from "zod";

loadEnv();

const bool = (def: boolean) =>
  z
    .string()
    .optional()
    .transform((v) => (v == null ? def : v === "true" || v === "1"));

const num = (def: number) =>
  z
    .string()
    .optional()
    .transform((v) => (v == null || v === "" ? def : Number(v)))
    .pipe(z.number());

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: num(4000),
  CORS_ORIGINS: z
    .string()
    .default("http://localhost:3000")
    .transform((v) => v.split(",").map((s) => s.trim()).filter(Boolean)),

  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),

  JWT_ACCESS_SECRET: z.string().min(8),
  JWT_REFRESH_SECRET: z.string().min(8),
  ACCESS_TOKEN_TTL: num(900),
  REFRESH_TOKEN_TTL: num(2_592_000),

  TURN_SECRET: z.string().default("dev-turn-secret"),
  TURN_URLS: z
    .string()
    .default("stun:localhost:3478")
    .transform((v) => v.split(",").map((s) => s.trim()).filter(Boolean)),
  TURN_TTL: num(86_400),

  S3_ENDPOINT: z.string().default("http://localhost:9000"),
  S3_REGION: z.string().default("us-east-1"),
  S3_BUCKET: z.string().default("nexa-media"),
  S3_ACCESS_KEY_ID: z.string().default("nexa"),
  S3_SECRET_ACCESS_KEY: z.string().default("nexa-secret"),
  S3_FORCE_PATH_STYLE: bool(true),

  RATE_LIMIT_WINDOW: num(60),
  RATE_LIMIT_MAX: num(120),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error("❌ Invalid environment:", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export const isProd = env.NODE_ENV === "production";
