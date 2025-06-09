#!/usr/bin/env node
// bacefook-generator.js
// --------------------------------------------------------------
// Usage:  node bacefook-generator.js <initialUserCount>
// --------------------------------------------------------------

const fs = require("fs");
const readline = require("readline");

/* ──────────────── JSDoc type definitions ───────────────────── */

/**
 * @typedef {"register"}  RegisterType
 * @typedef {"referral"}  ReferralType
 * @typedef {"addfriend"} AddFriendType
 * @typedef {"unfriend"}  UnfriendType
 */

/**
 * @typedef {Object} RegisterEvent
 * @property {RegisterType} type
 * @property {string} name
 * @property {string} created_at
 *
 * @typedef {Object} ReferralEvent
 * @property {ReferralType} type
 * @property {string} referredBy
 * @property {string} user
 * @property {string} created_at
 *
 * @typedef {Object} AddFriendEvent
 * @property {AddFriendType} type
 * @property {string} user1_name
 * @property {string} user2_name
 * @property {string} created_at
 *
 * @typedef {Object} UnfriendEvent
 * @property {UnfriendType} type
 * @property {string} user1_name
 * @property {string} user2_name
 * @property {string} created_at
 *
 * @typedef { RegisterEvent | ReferralEvent | AddFriendEvent | UnfriendEvent } Event
 */



/* ──────────────────── utility helpers ───────────────────────── */

/** @param {number} min @param {number} max */
const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
/** @param {number} p */
const chance = (p) => Math.random() < p;
/** @param {string} a @param {string} b */
const pairKey = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`);
/** @returns {string} compact, file-system-safe ISO timestamp (YYYYMMDDTHHMMSSZ) */
const timestamp = () => new Date().toISOString().replace(/[-:.]/g, "");

/* ──────────────────── global state ─────────────────────────── */

let users = /** @type {string[]} */ ([]);
let friendships = /** @type {Set<string>} */ (new Set());

/* ──────────────────── name generator ───────────────────────── */

/** @param {number} idx */
const nextUserName = (idx) => `user${String(idx + 1).padStart(5, "0")}`;

/* ─────────────── event-creation functions ───────────────────── */

/**
 * Registers N users starting at `startIdx`.
 * @param {number} n
 * @param {number} startIdx
 * @param {string} ts
 * @returns {RegisterEvent[]}
 */
function registerUsers(n, startIdx, ts) {
  /** @type {RegisterEvent[]} */
  const events = [];
  for (let i = 0; i < n; i++) {
    const name = nextUserName(startIdx + i);
    users.push(name);
    events.push({ type: "register", name, created_at: ts });
  }
  return events;
}

/**
 * Creates referral events for a set of new users.
 * @param {string[]} newUserNames
 * @param {string} ts
 * @returns {ReferralEvent[]}
 */
function referralEvents(newUserNames, ts) {
  /** @type {ReferralEvent[]} */
  const events = [];
  newUserNames.forEach((user) => {
    if (users.length > 1 && chance(0.2)) {
      let referrer;
      do {
        referrer = users[randInt(0, users.length - 2)];
      } while (referrer === user);
      events.push({ type: "referral", referredBy: referrer, user, created_at: ts });
    }
  });
  return events;
}

/**
 * Adds initial friendships so each user ends up with up to min(200, 0.5 n) friends.
 * @param {string} ts
 * @returns {AddFriendEvent[]}
 */
function addInitialFriendships(ts) {
  /** @type {AddFriendEvent[]} */
  const events = [];
  const cap = Math.min(200, Math.floor(users.length * 0.5));

  users.forEach((u) => {
    const target = randInt(0, cap);
    while (degree(u) < target) {
      const v = users[randInt(0, users.length - 1)];
      if (u === v) continue;
      const key = pairKey(u, v);
      if (friendships.has(key)) continue;
      friendships.add(key);
      events.push({ type: "addfriend", user1_name: u, user2_name: v, created_at: ts });
    }
  });
  return events;
}

/**
 * Randomly un-friends 20 % of existing friendships.
 * @param {string} ts
 * @returns {UnfriendEvent[]}
 */
function unfriendRandomSubset(ts) {
  /** @type {UnfriendEvent[]} */
  const events = [];
  friendships.forEach((key) => {
    if (chance(0.2)) {
      friendships.delete(key);
      const [u1, u2] = key.split("|");
      events.push({ type: "unfriend", user1_name: u1, user2_name: u2, created_at: ts });
    }
  });
  return events;
}

/**
 * Creates new friendships for about 30 % of users (one friend each).
 * @param {string} ts
 * @returns {AddFriendEvent[]}
 */
function addNewFriendships(ts) {
  /** @type {AddFriendEvent[]} */
  const events = [];
  users.forEach((u) => {
    if (!chance(0.3)) return;
    for (let t = 0; t < 10; t++) {
      const v = users[randInt(0, users.length - 1)];
      if (u === v) continue;
      const key = pairKey(u, v);
      if (friendships.has(key)) continue;
      friendships.add(key);
      events.push({ type: "addfriend", user1_name: u, user2_name: v, created_at: ts });
      break;
    }
  });
  return events;
}

/** @param {string} user */
function degree(user) {
  let d = 0;
  friendships.forEach((key) => {
    if (key.startsWith(`${user}|`) || key.endsWith(`|${user}`)) d++;
  });
  return d;
}

/* ─────────────────── file-writing helper ───────────────────── */

/**
 * @param {Event[]} events
 * @param {string} ts
 */
function writeEventsFile(events, ts) {
  const file = `bacefook-events-${ts}.json`;
  fs.writeFileSync(file, JSON.stringify(events, null, 2), "utf8");
  console.log(`✨  Wrote ${events.length} events → ${file}`);
}

/* ─────────────────── interactive driver ────────────────────── */

(function main() {
  const startCount = parseInt(process.argv[2] || "100", 10);
  if (!Number.isFinite(startCount) || startCount <= 0) {
    console.error("Please supply a positive integer for initial user count."); // prettier-ignore
    process.exit(1);
  }

  generateBatch(startCount); // bootstrap
  prompt();
})();

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
rl.on("line", () => generateBatch(randInt(10, 19)));

/* ─────────────────── batch generator ───────────────────────── */

/**
 * Generates one “generation” of events and writes them to disk.
 * @param {number} newUserCount
 */
function generateBatch(newUserCount) {
  const ts = timestamp();

  // new registrations
  const regEvents = registerUsers(newUserCount, users.length, ts);
  const newNames = users.slice(-newUserCount);

  // referrals (0.2 chance per new user)
  const refEvents = referralEvents(newNames, ts);

  // friend / unfriend logic
  const unfriendEvents = unfriendRandomSubset(ts);
  const friendEvents =
    users.length === newUserCount
      ? addInitialFriendships(ts) // first generation only
      : addNewFriendships(ts);    // subsequent generations

  writeEventsFile(
    [...regEvents, ...unfriendEvents, ...friendEvents, ...refEvents],
    ts
  );
}

/* ─────────────────── prompt helper ─────────────────────────── */

function prompt() {
  console.log("\nPress Enter to generate the next events…");
}
