import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env, isProd } from "./env.js";
import * as schema from "../db/schema.js";

/**
 * postgres.js client. Works for both local Postgres and Neon (pooled connection
 * string). SSL is auto-enabled when the URL requests it (Neon uses sslmode=require).
 */
const needsSsl = /sslmode=require|neon\.tech/.test(env.DATABASE_URL);

export const sql = postgres(env.DATABASE_URL, {
  max: isProd ? 10 : 5,
  ssl: needsSsl ? "require" : undefined,
  onnotice: () => {},
});

export const db = drizzle(sql, { schema });
export type Database = typeof db;
