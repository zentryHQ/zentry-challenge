#!/usr/bin/env node
// bacefook-generator.js (Optimized Version)
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

const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const chance = (p) => Math.random() < p;
const timestamp = () => new Date().toISOString().replace(/[-:.]/g, "");

/* ──────────────────── global state ─────────────────────────── */

let users = /** @type {string[]} */ ([]);
let friendships = /** @type {Map<string, Set<string>>} */ (new Map());

/* ──────────────────── name generator ───────────────────────── */

const nextUserName = (idx) => `user${String(idx + 1).padStart(5, "0")}`;

/* ─────────────── event-creation functions ───────────────────── */

function registerUsers(n, startIdx, ts) {
  const events = [];
  for (let i = 0; i < n; i++) {
    const name = nextUserName(startIdx + i);
    users.push(name);
    events.push({ type: "register", name, created_at: ts });
  }
  return events;
}

function referralEvents(newUserNames, ts) {
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

function addFriend(u, v) {
  if (u === v) return false;
  if (!friendships.has(u)) friendships.set(u, new Set());
  if (!friendships.has(v)) friendships.set(v, new Set());

  const uSet = friendships.get(u);
  const vSet = friendships.get(v);
  if (uSet.has(v)) return false;

  uSet.add(v);
  vSet.add(u);
  return true;
}

function removeFriend(u, v) {
  friendships.get(u)?.delete(v);
  friendships.get(v)?.delete(u);
}

function degree(user) {
  return friendships.get(user)?.size || 0;
}

function addInitialFriendships(ts) {
  const events = [];
  const cap = Math.min(200, Math.floor(users.length * 0.5));

  users.forEach((u) => {
    const target = randInt(0, cap);
    while (degree(u) < target) {
      const v = users[randInt(0, users.length - 1)];
      if (addFriend(u, v)) {
        events.push({ type: "addfriend", user1_name: u, user2_name: v, created_at: ts });
      }
    }
  });

  return events;
}

function addNewFriendships(ts) {
  const events = [];
  users.forEach((u) => {
    if (!chance(0.3)) return;
    for (let i = 0; i < 10; i++) {
      const v = users[randInt(0, users.length - 1)];
      if (addFriend(u, v)) {
        events.push({ type: "addfriend", user1_name: u, user2_name: v, created_at: ts });
        break;
      }
    }
  });
  return events;
}

function unfriendRandomSubset(ts) {
  const events = [];
  for (const [u, friendSet] of friendships) {
    for (const v of [...friendSet]) {
      if (u < v && chance(0.2)) {
        removeFriend(u, v);
        events.push({ type: "unfriend", user1_name: u, user2_name: v, created_at: ts });
      }
    }
  }
  return events;
}

/* ─────────────────── file-writing helper ───────────────────── */

/**
 * 
 * @param {unknown[]} events 
 * @param {string} ts 
 */

function writeEventsFile(events, ts) {
  const CHUNK_SIZE = 100_000;

  for (let i = 0; i < events.length; i += CHUNK_SIZE) {
    const chunk = events.slice(i, i + CHUNK_SIZE);
    const file = `bacefook-events-${ts}-${i / CHUNK_SIZE + 1}.json`;
    fs.writeFileSync(file, JSON.stringify(chunk, null, 2), "utf8");
    console.log(`✨  Wrote ${chunk.length} events → ${file}`);
  }
}

/* ─────────────────── batch generator ───────────────────────── */

function generateBatch(newUserCount) {
  const ts = timestamp();
  const regEvents = registerUsers(newUserCount, users.length, ts);
  const newNames = users.slice(-newUserCount);
  const refEvents = referralEvents(newNames, ts);
  const unfriendEvents = unfriendRandomSubset(ts);
  const friendEvents =
    users.length === newUserCount
      ? addInitialFriendships(ts)
      : addNewFriendships(ts);

  writeEventsFile(
    [...regEvents, ...unfriendEvents, ...friendEvents, ...refEvents],
    ts
  );
}

/* ─────────────────── interactive driver ────────────────────── */

(function main() {
  const startCount = parseInt(process.argv[2] || "100", 10);
  if (!Number.isFinite(startCount) || startCount <= 0) {
    console.error("Please supply a positive integer for initial user count.");
    process.exit(1);
  }

  generateBatch(startCount);
  prompt();
})();

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
rl.on("line", () => generateBatch(randInt(10, 19)));

function prompt() {
  console.log("\nPress Enter to generate the next events…");
}
