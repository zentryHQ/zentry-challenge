import { EventsGenerator } from "./events-generator";

async function startGenerator() {
  const generator = new EventsGenerator();

  const endpoint = process.argv[2];

  const controller = new AbortController();
  const { signal } = controller;
  let timeoutId: NodeJS.Timeout | null = null;

  const perIteration = 20_000;
  let soFar = 0;
  for await (const events of generator.stream(perIteration)) {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }

    timeoutId = setTimeout(() => {
      if (soFar < 20_000 * 5) {
        // throughput too low, abort
        controller.abort();
      }
    }, 1000);

    await fetch(endpoint, {
      method: "POST",
      body: JSON.stringify({ events }),
      headers: {
        "Content-Type": "application/json",
      },
      signal,
    });
  }
}

void startGenerator();
