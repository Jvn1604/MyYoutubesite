/**
 * Password hashing with Node's built-in scrypt (memory-hard, no native deps).
 * Stored format: scrypt$<N>$<r>$<p>$<salt b64url>$<hash b64url>
 */
import { scrypt, randomBytes, timingSafeEqual } from "node:crypto";

const PARAMS = { N: 2 ** 15, r: 8, p: 1 };
const KEY_LEN = 64;
const MAX_MEM = 64 * 1024 * 1024;

export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 256; // bound the work an attacker can make us do

const derive = (password, salt, { N, r, p }) =>
  new Promise((resolve, reject) =>
    scrypt(password.normalize("NFKC"), salt, KEY_LEN, { N, r, p, maxmem: MAX_MEM }, (err, key) => (err ? reject(err) : resolve(key))));

export async function hashPassword(password) {
  const salt = randomBytes(16);
  const key = await derive(password, salt, PARAMS);
  return ["scrypt", PARAMS.N, PARAMS.r, PARAMS.p, salt.toString("base64url"), key.toString("base64url")].join("$");
}

export async function verifyPassword(password, stored) {
  if (typeof password !== "string" || password.length > PASSWORD_MAX_LENGTH) return false;
  const parts = String(stored ?? "").split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [, N, r, p, salt, hash] = parts;
  const expected = Buffer.from(hash, "base64url");
  const actual = await derive(password, Buffer.from(salt, "base64url"), { N: +N, r: +r, p: +p });
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/** Basic strength rules. Returns an error message or null. */
export function passwordProblem(password) {
  if (typeof password !== "string" || password.length < PASSWORD_MIN_LENGTH) return `Use at least ${PASSWORD_MIN_LENGTH} characters.`;
  if (password.length > PASSWORD_MAX_LENGTH) return "Password is too long.";
  if (/^(.)\1+$/.test(password)) return "Password can't be one repeated character.";
  if (/^(password|dephantom|phantom|12345)/i.test(password)) return "Password is too easy to guess.";
  return null;
}

// A real hash of a random value: verifying against it costs the same time as a real account,
// so "unknown email" and "wrong password" are indistinguishable by timing.
let dummyHash;
export async function dummyVerify(password) {
  dummyHash ??= await hashPassword(randomBytes(16).toString("hex"));
  await verifyPassword(String(password ?? "").slice(0, PASSWORD_MAX_LENGTH), dummyHash);
  return false;
}
