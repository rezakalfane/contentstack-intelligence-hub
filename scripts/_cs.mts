// Shared helpers for the maintenance scripts (backup / degrade / restore). Never prints secrets.
import { CmaClient } from "../lib/adapters/cma-client";

process.loadEnvFile(".env.local");
const e = process.env;
if (!e.CONTENTSTACK_API_BASE_URL || !e.CONTENTSTACK_API_KEY || !e.CONTENTSTACK_MANAGEMENT_TOKEN) throw new Error("Missing Contentstack env in .env.local");

export const branch = e.CONTENTSTACK_BRANCH ?? "main";
export const client = new CmaClient({ base: e.CONTENTSTACK_API_BASE_URL, apiKey: e.CONTENTSTACK_API_KEY, token: e.CONTENTSTACK_MANAGEMENT_TOKEN, branch });
export const MASTER = e.CONTENTSTACK_MASTER_LOCALE ?? "en-us";
export const TARGET = "fr-fr";
export const SYSTEM_KEYS = new Set(["uid", "created_by", "updated_by", "created_at", "updated_at", "ACL", "_version", "tags", "_in_progress", "locale", "publish_details", "_workflow"]);

export const flag = (n: string) => process.argv.includes(`--${n}`);
export const arg = (i: number) => process.argv.slice(2).filter((a) => !a.startsWith("--"))[i];
export const stripSystem = (raw: Record<string, unknown>) => Object.fromEntries(Object.entries(raw).filter(([k]) => !SYSTEM_KEYS.has(k)));
