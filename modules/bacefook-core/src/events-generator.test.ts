import { EventsGenerator } from "./events-generator";

describe("EventsGenerator", () => {
  let generator: EventsGenerator;

  beforeEach(() => {
    generator = new EventsGenerator();
  });

  it("should generate a batch with correct register events", async () => {
    const count = 10;
    const stream = generator.stream(count);
    const { value: events } = await stream.next();

    expect(events).toBeDefined();
    const registerEvents = events!.filter((e) => e.type === "register");
    expect(registerEvents.length).toBe(count);
    registerEvents.forEach((e, i) => {
      expect(e.name).toBe(`user${String(i + 1).padStart(5, "0")}`);
      expect(typeof e.created_at).toBe("string");
    });
  });

  it("should yield multiple different batches over time", async () => {
    const count = 5;
    const stream = generator.stream(count);

    const batch1 = (await stream.next()).value!;
    const batch2 = (await stream.next()).value!;

    expect(Array.isArray(batch1)).toBe(true);
    expect(Array.isArray(batch2)).toBe(true);
    expect(batch1.length).toBeGreaterThan(0);
    expect(batch2.length).toBeGreaterThan(0);

    // At least some difference between batches
    expect(batch1).not.toEqual(batch2);
  });

  it("should generate referrals at ~20% rate", async () => {
    const count = 100;
    const { value: events } = await generator.stream(count).next();

    const referrals = events!.filter((e) => e.type === "referral");
    const ratio = referrals.length / count;

    expect(ratio).toBeGreaterThan(0.05); // lower bound
    expect(ratio).toBeLessThan(0.4); // upper bound
  });

  it("should generate undirected, unique friendships", async () => {
    const count = 20;
    const { value: events } = await generator.stream(count).next();

    const seen = new Set<string>();
    for (const event of events!) {
      if (event.type === "addfriend") {
        const key = [event.user1_name, event.user2_name].sort().join("|");
        expect(seen.has(key)).toBe(false);
        seen.add(key);
      }
    }
  });

  it("should generate some unfriend events on second generation", async () => {
    const count = 50;
    const { value: genesis } = await generator.stream(count).next();
    const first = genesis!.filter((e) => e.type === "unfriend");
    expect(first.length).toBe(0);

    const { value: secondEvents } = await generator.stream(count).next();
    const second = secondEvents!.filter((e) => e.type === "unfriend");
    expect(second.length).toBeGreaterThan(0);
  });

  it("should throw on invalid stream argument", async () => {
    const badInputs = [0, -5, Infinity, NaN];

    for (const input of badInputs) {
      await expect(async () => {
        const stream = generator.stream(input);
        await stream.next(); // triggers validation
      }).rejects.toThrow("Please supply a positive integer");
    }
  });
});
