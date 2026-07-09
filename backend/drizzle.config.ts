import type { Config } from "drizzle-kit";

export default {
  schema: "./src/db/schema.ts",
  out: "../database/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgres://nexa:nexa@localhost:5432/nexa",
  },
} satisfies Config;
