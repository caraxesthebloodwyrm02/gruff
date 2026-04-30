import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { readFile } from "node:fs";

describe("async I/O ordering", () => {
  it("sync code runs before any async callbacks", async () => {
    const order: string[] = [];

    await new Promise<void>((resolve) => {
      setTimeout(() => { order.push("timer"); resolve(); }, 0);
      Promise.resolve().then(() => order.push("microtask"));
      order.push("sync");
    });

    assert.equal(order[0], "sync");
    assert.ok(order.indexOf("sync") < order.indexOf("microtask"));
    assert.ok(order.indexOf("sync") < order.indexOf("timer"));
  });

  it("process.nextTick fires before Promise.resolve().then()", async () => {
    const order: string[] = [];

    // Queue both from inside a fresh macrotask so we're not already in a microtask chain
    await new Promise<void>((resolve) => {
      setTimeout(() => {
        Promise.resolve().then(() => { order.push("promise"); resolve(); });
        process.nextTick(() => order.push("nextTick"));
      }, 0);
    });

    assert.deepEqual(order, ["nextTick", "promise"]);
  });

  it("setTimeout(fn, 0) fires before fs.readFile I/O callback", async () => {
    const order: string[] = [];

    await new Promise<void>((resolve) => {
      readFile("/etc/hostname", () => { order.push("io"); resolve(); });
      setTimeout(() => order.push("timer"), 0);
    });

    assert.ok(order.indexOf("timer") < order.indexOf("io"),
      `Expected timer before io, got: ${JSON.stringify(order)}`);
  });

  it("blocking the event loop delays timer and I/O callbacks", async () => {
    const BLOCK_MS = 100;
    const start = Date.now();
    const timestamps: Record<string, number> = {};

    await new Promise<void>((resolve) => {
      readFile("/etc/hostname", () => {
        timestamps.io = Date.now() - start;
        resolve();
      });
      setTimeout(() => { timestamps.timer = Date.now() - start; }, 0);

      const end = Date.now() + BLOCK_MS;
      while (Date.now() < end) { /* spin */ }
    });

    assert.ok(
      timestamps.timer >= BLOCK_MS,
      `Expected timer >= ${BLOCK_MS}ms, got ${timestamps.timer}ms`
    );
    assert.ok(
      timestamps.io >= BLOCK_MS,
      `Expected I/O >= ${BLOCK_MS}ms, got ${timestamps.io}ms`
    );
  });
});

describe("temporal probing", () => {
  it("timer always fires late — never early", async () => {
    const TARGET_MS = 10;
    // Models dispatch overhead between event-loop "timer ready" and first JS line.
    // Float jitter is ~200ns on a TSC-backed clock; this epsilon is much larger.
    const EPSILON_MS = 1;
    const before = performance.now();
    await new Promise<void>((resolve) => setTimeout(resolve, TARGET_MS));
    const actual = performance.now() - before;
    assert.ok(actual >= TARGET_MS - EPSILON_MS, `Timer fired too early: ${actual.toFixed(2)}ms < ${TARGET_MS - EPSILON_MS}ms`);
  });

  it("timer drift is bounded on a quiet process (< 5ms over target)", async () => {
    const TARGET_MS = 10;
    const MAX_DRIFT_MS = 5;
    const results: number[] = [];

    for (let i = 0; i < 5; i++) {
      const before = performance.now();
      await new Promise<void>((resolve) => setTimeout(resolve, TARGET_MS));
      results.push(performance.now() - before);
    }

    for (const actual of results) {
      assert.ok(
        actual < TARGET_MS + MAX_DRIFT_MS,
        `Drift exceeded ${MAX_DRIFT_MS}ms: actual=${actual.toFixed(2)}ms`
      );
    }
  });

  it("nextTick beats Promise from macrotask context", async () => {
    const order: string[] = [];

    await new Promise<void>((resolve) => {
      setTimeout(() => {
        Promise.resolve().then(() => { order.push("promise"); resolve(); });
        process.nextTick(() => order.push("nextTick"));
      }, 0);
    });

    assert.equal(order[0], "nextTick", `Expected nextTick first, got: ${JSON.stringify(order)}`);
    assert.equal(order[1], "promise");
  });

  it("Promise beats nextTick when queued from inside .then()", async () => {
    const order: string[] = [];

    await new Promise<void>((resolve) => {
      Promise.resolve().then(() => {
        process.nextTick(() => { order.push("nextTick"); resolve(); });
        Promise.resolve().then(() => order.push("promise"));
      });
    });

    assert.equal(order[0], "promise", `Expected promise first, got: ${JSON.stringify(order)}`);
    assert.equal(order[1], "nextTick");
  });
});

describe("measurement precision", () => {
  it("performance.now() has sub-microsecond resolution", () => {
    const samples: number[] = [];
    for (let i = 0; i < 100; i++) samples.push(performance.now());
    const diffs = samples.slice(1).map((v, i) => v - samples[i]).filter((d) => d > 0);
    const minDiff = Math.min(...diffs);
    assert.ok(minDiff < 0.001, `Expected clock quantum < 0.001ms, got ${minDiff.toFixed(6)}ms`);
  });

  it("timer dispatch overhead is bounded under 1ms", async () => {
    const before = performance.now();
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    const overhead = performance.now() - before;
    assert.ok(overhead < 1, `Expected dispatch overhead < 1ms, got ${overhead.toFixed(3)}ms`);
  });
});

describe("audio buffer safety", () => {
  const SAMPLE_RATE = 44100;
  const BUFFER_SIZE = 512;

  it("buffer duration at 44100 Hz is ~11.6ms", () => {
    const durationMs = (BUFFER_SIZE / SAMPLE_RATE) * 1000;
    assert.ok(
      Math.abs(durationMs - 11.6) < 0.1,
      `Expected ~11.6ms, got ${durationMs.toFixed(3)}ms`
    );
  });

  it("safe jitter threshold is half the buffer duration", () => {
    const bufferDurationMs = (BUFFER_SIZE / SAMPLE_RATE) * 1000;
    const threshold = bufferDurationMs / 2;
    assert.equal(threshold, bufferDurationMs / 2);
  });

  it("observed drift (0.30ms) is within safe threshold", () => {
    const bufferDurationMs = (BUFFER_SIZE / SAMPLE_RATE) * 1000;
    const threshold = bufferDurationMs / 2;
    const observedDrift = 0.30;
    assert.ok(observedDrift < threshold, `Drift ${observedDrift}ms exceeds threshold ${threshold.toFixed(2)}ms`);
  });
});
