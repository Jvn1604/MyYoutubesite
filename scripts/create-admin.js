#!/usr/bin/env node
/**
 * Create the admin account (or reset its password).
 *   npm run admin:create                      uses ADMIN_EMAIL from .env, asks for the password
 *   npm run admin:create -- you@example.com   explicit email
 *   npm run admin:create -- --reset           change the password (signs out all sessions)
 * The password is typed hidden and never echoed, logged or stored in plain text.
 */
import { createInterface } from "node:readline";
import { createDb } from "../server/db/client.js";
import { createAdmin } from "../server/services/auth.js";
import { PASSWORD_MIN_LENGTH } from "../server/services/passwords.js";

const args = process.argv.slice(2);
const reset = args.includes("--reset");
const email = args.find((a) => !a.startsWith("--")) ?? process.env.ADMIN_EMAIL;

if (!email) {
  console.error("No email given. Set ADMIN_EMAIL in .env or run: npm run admin:create -- you@example.com");
  process.exit(1);
}
if (!process.env.DATABASE_URL || !process.env.SESSION_SECRET) {
  console.error("DATABASE_URL and SESSION_SECRET must be set (see .env.example).");
  process.exit(1);
}

function askHidden(question) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    let muted = false;
    rl._writeToOutput = (s) => { if (!muted) process.stdout.write(s); else if (s.includes("\n")) process.stdout.write("\n"); };
    rl.question(question, (answer) => { rl.close(); resolve(answer); });
    muted = true;
  });
}

let password = process.env.ADMIN_PASSWORD; // non-interactive use (CI); prefer the prompt
if (!password) {
  if (!process.stdin.isTTY) {
    console.error("Run this in an interactive terminal so the password can be typed hidden.");
    process.exit(1);
  }
  password = await askHidden(`Password for ${email} (min ${PASSWORD_MIN_LENGTH} characters): `);
  const confirm = await askHidden("Repeat password: ");
  if (password !== confirm) {
    console.error("Passwords don't match.");
    process.exit(1);
  }
}

const db = await createDb();
try {
  const admin = await createAdmin(db, { email, password, reset });
  console.log(admin.reset ? `✓ Password reset for ${admin.email}. All sessions were signed out.` : `✓ Admin ${admin.email} created. Sign in at /admin/login`);
} catch (err) {
  console.error(`✗ ${err.message}`);
  process.exitCode = 1;
} finally {
  await db.close();
}
