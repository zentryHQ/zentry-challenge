import {
  AddFriendEvent,
  ConnectionEvent,
  ReferralEvent,
  RegisterEvent,
  UnfriendEvent,
} from "./types";
import { Utils } from "./utils";

export class EventsGenerator {
  private users: string[] = [];
  private friendships: Map<string, Set<string>> = new Map();

  private nextUserName(idx: number): string {
    return `user${String(idx + 1).padStart(5, "0")}`;
  }

  private registerUsers(
    n: number,
    startIdx: number,
    ts: string
  ): RegisterEvent[] {
    const events: RegisterEvent[] = [];
    for (let i = 0; i < n; i++) {
      const name = this.nextUserName(startIdx + i);
      this.users.push(name);
      events.push({ type: "register", name, created_at: ts });
    }
    return events;
  }

  private referralEvents(newUserNames: string[], ts: string): ReferralEvent[] {
    const events: ReferralEvent[] = [];
    newUserNames.forEach((user) => {
      if (this.users.length > 1 && Utils.chance(0.2)) {
        let referrer: string;
        do {
          referrer = this.users[Utils.randInt(0, this.users.length - 2)];
        } while (referrer === user);
        events.push({
          type: "referral",
          referredBy: referrer,
          user,
          created_at: ts,
        });
      }
    });
    return events;
  }

  private addFriend(u: string, v: string): boolean {
    if (u === v) return false;
    if (!this.friendships.has(u)) this.friendships.set(u, new Set());
    if (!this.friendships.has(v)) this.friendships.set(v, new Set());

    const uSet = this.friendships.get(u)!;
    const vSet = this.friendships.get(v)!;
    if (uSet.has(v)) return false;

    uSet.add(v);
    vSet.add(u);
    return true;
  }

  private removeFriend(u: string, v: string): void {
    this.friendships.get(u)?.delete(v);
    this.friendships.get(v)?.delete(u);
  }

  private degree(user: string): number {
    return this.friendships.get(user)?.size || 0;
  }

  private addInitialFriendships(ts: string): AddFriendEvent[] {
    const events: AddFriendEvent[] = [];
    const cap = Math.min(200, Math.floor(this.users.length * 0.5));

    this.users.forEach((u) => {
      const target = Utils.randInt(0, cap);
      while (this.degree(u) < target) {
        const v = this.users[Utils.randInt(0, this.users.length - 1)];
        if (this.addFriend(u, v)) {
          events.push({
            type: "addfriend",
            user1_name: u,
            user2_name: v,
            created_at: ts,
          });
        }
      }
    });

    return events;
  }

  private addNewFriendships(ts: string): AddFriendEvent[] {
    const events: AddFriendEvent[] = [];
    this.users.forEach((u) => {
      if (!Utils.chance(0.3)) return;
      for (let i = 0; i < 10; i++) {
        const v = this.users[Utils.randInt(0, this.users.length - 1)];
        if (this.addFriend(u, v)) {
          events.push({
            type: "addfriend",
            user1_name: u,
            user2_name: v,
            created_at: ts,
          });
          break;
        }
      }
    });
    return events;
  }

  private unfriendRandomSubset(ts: string): UnfriendEvent[] {
    const events: UnfriendEvent[] = [];
    for (const [u, friendSet] of this.friendships.entries()) {
      for (const v of [...friendSet]) {
        if (u < v && Utils.chance(0.2)) {
          this.removeFriend(u, v);
          events.push({
            type: "unfriend",
            user1_name: u,
            user2_name: v,
            created_at: ts,
          });
        }
      }
    }
    return events;
  }

  private generateBatch(newUserCount: number): ConnectionEvent[] {
    const ts = Utils.timestamp();
    const regEvents = this.registerUsers(newUserCount, this.users.length, ts);
    const newNames = this.users.slice(-newUserCount);
    const refEvents = this.referralEvents(newNames, ts);
    const unfriendEvents = this.unfriendRandomSubset(ts);
    const friendEvents =
      this.users.length === newUserCount
        ? this.addInitialFriendships(ts)
        : this.addNewFriendships(ts);

    return [...regEvents, ...unfriendEvents, ...friendEvents, ...refEvents];
  }

  /**
   * Call this function to generate events
   */
  public async *stream(count: number) {
    if (!Number.isFinite(count) || count <= 0) {
      throw new Error(
        "Please supply a positive integer for initial user count."
      );
    }

    for (;;) {
      yield this.generateBatch(count);
    }
  }
}
