#!/usr/bin/env node
/**
 * Local Postgres for development, no install needed: `npm run db:local`.
 * Runs PGlite (real Postgres compiled to WASM) in this one process and serves
 * the normal Postgres wire protocol, so the dev server, CLI scripts and any SQL
 * client connect with an ordinary postgres:// URL, exactly like Supabase in production.
 *
 *   DATABASE_URL=postgres://postgres:postgres@127.0.0.1:54329/postgres
 *
 * Data lives in ./.data/db (git-ignored). Stop with Ctrl+C.
 */
import { mkdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";

const DATA_DIR = process.env.LOCAL_DB_DIR ?? "./.data/db";
const PORT = Number(process.env.LOCAL_DB_PORT ?? 54329);
const HOST = "127.0.0.1"; // never expose the dev database beyond this machine

await mkdir(DATA_DIR, { recursive: true });
const db = new PGlite(DATA_DIR);
await db.waitReady;

// PGlite is a single Postgres session: serve one connection at a time and queue the rest.
// (Overlapping connections on one session can interleave and stall.) The app closes
// local connections right after each request (see withDb), so the queue drains quickly.
const server = new PGLiteSocketServer({ db, port: PORT, host: HOST, maxConnections: 1 });
await server.start();
console.log(`Local Postgres ready: postgres://postgres:postgres@${HOST}:${PORT}/postgres  (data: ${DATA_DIR})`);

const shutdown = async () => {
  console.log("\nStopping local Postgres…");
  await server.stop();
  await db.close();
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
