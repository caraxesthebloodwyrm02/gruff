import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { validateProportionPayload } from "./proportion.js";

const minimal = {
  schemaVersion: "1.0.0" as const,
  t: 1,
  theta: 0.5,
  cog: { x: 0.5, y: 0.5 },
  weights: { sound: 0.34, gesture: 0.33, calculation: 0.33 },
  modulation: {
    gains: { a: 1 },
    clamps: { min: 0, max: 1 },
  },
  sequence: { id: "s", stepIndex: 0, stepName: "n" },
  metrics: { raw: { a: 1 }, modulated: { a: 1 } },
  audioDrive: 0.5,
};

// ─── Valid documents ────────────────────────────────────────────────────────

describe("valid documents", () => {
  test("minimal document passes", () => {
    const r = validateProportionPayload(minimal);
    assert.equal(r.valid, true);
  });

  test("theta at minimum boundary (0) passes", () => {
    const r = validateProportionPayload({ ...minimal, theta: 0 });
    assert.equal(r.valid, true);
  });

  test("theta just below exclusiveMaximum (0.9999) passes", () => {
    const r = validateProportionPayload({ ...minimal, theta: 0.9999 });
    assert.equal(r.valid, true);
  });

  test("audioDrive at 0 passes", () => {
    const r = validateProportionPayload({ ...minimal, audioDrive: 0 });
    assert.equal(r.valid, true);
  });

  test("audioDrive at 1 passes", () => {
    const r = validateProportionPayload({ ...minimal, audioDrive: 1 });
    assert.equal(r.valid, true);
  });

  test("weights all at 0 passes (schema does not enforce sum)", () => {
    const r = validateProportionPayload({
      ...minimal,
      weights: { sound: 0, gesture: 0, calculation: 0 },
    });
    assert.equal(r.valid, true);
  });

  test("sequence.stepIndex at 0 passes", () => {
    const r = validateProportionPayload({
      ...minimal,
      sequence: { id: "x", stepIndex: 0, stepName: "start" },
    });
    assert.equal(r.valid, true);
  });

  test("metrics with multiple keys passes", () => {
    const r = validateProportionPayload({
      ...minimal,
      metrics: {
        raw: { a: 1, b: 2, c: 3 },
        modulated: { a: 0.5, b: 1.0, c: 1.5 },
      },
    });
    assert.equal(r.valid, true);
  });

  test("t as a large float passes", () => {
    const r = validateProportionPayload({ ...minimal, t: 1_234_567.89 });
    assert.equal(r.valid, true);
  });
});

// ─── Type errors ────────────────────────────────────────────────────────────

describe("type errors", () => {
  test("theta as string fails", () => {
    const r = validateProportionPayload({ ...minimal, theta: "bad" });
    assert.equal(r.valid, false);
  });

  test("t as string fails", () => {
    const r = validateProportionPayload({ ...minimal, t: "now" });
    assert.equal(r.valid, false);
  });

  test("audioDrive as string fails", () => {
    const r = validateProportionPayload({ ...minimal, audioDrive: "loud" });
    assert.equal(r.valid, false);
  });

  test("audioDrive as boolean fails", () => {
    const r = validateProportionPayload({ ...minimal, audioDrive: true });
    assert.equal(r.valid, false);
  });

  test("non-object body (array) fails", () => {
    const r = validateProportionPayload([]);
    assert.equal(r.valid, false);
  });

  test("non-object body (string) fails", () => {
    const r = validateProportionPayload("hello");
    assert.equal(r.valid, false);
  });

  test("non-object body (null) fails", () => {
    const r = validateProportionPayload(null);
    assert.equal(r.valid, false);
  });

  test("sequence.stepIndex as float fails", () => {
    const r = validateProportionPayload({
      ...minimal,
      sequence: { ...minimal.sequence, stepIndex: 1.5 },
    });
    assert.equal(r.valid, false);
  });

  test("sequence.id as number fails", () => {
    const r = validateProportionPayload({
      ...minimal,
      sequence: { ...minimal.sequence, id: 42 },
    });
    assert.equal(r.valid, false);
  });

  test("cog.x as string fails", () => {
    const r = validateProportionPayload({
      ...minimal,
      cog: { x: "left", y: 0.5 },
    });
    assert.equal(r.valid, false);
  });

  test("metrics.raw with non-number value fails", () => {
    const r = validateProportionPayload({
      ...minimal,
      metrics: { raw: { a: "high" }, modulated: { a: 1 } },
    });
    assert.equal(r.valid, false);
  });
});

// ─── schemaVersion constraint ────────────────────────────────────────────────

describe("schemaVersion", () => {
  test("wrong version '2.0.0' fails", () => {
    const r = validateProportionPayload({ ...minimal, schemaVersion: "2.0.0" });
    assert.equal(r.valid, false);
  });

  test("empty string version fails", () => {
    const r = validateProportionPayload({ ...minimal, schemaVersion: "" });
    assert.equal(r.valid, false);
  });

  test("numeric version fails", () => {
    const r = validateProportionPayload({ ...minimal, schemaVersion: 1 });
    assert.equal(r.valid, false);
  });
});

// ─── Range violations ────────────────────────────────────────────────────────

describe("range violations", () => {
  test("theta exactly 1 fails (exclusiveMaximum)", () => {
    const r = validateProportionPayload({ ...minimal, theta: 1 });
    assert.equal(r.valid, false);
  });

  test("theta negative fails", () => {
    const r = validateProportionPayload({ ...minimal, theta: -0.1 });
    assert.equal(r.valid, false);
  });

  test("audioDrive above 1 fails", () => {
    const r = validateProportionPayload({ ...minimal, audioDrive: 1.5 });
    assert.equal(r.valid, false);
  });

  test("audioDrive negative fails", () => {
    const r = validateProportionPayload({ ...minimal, audioDrive: -0.1 });
    assert.equal(r.valid, false);
  });

  test("weights.sound above 1 fails", () => {
    const r = validateProportionPayload({
      ...minimal,
      weights: { sound: 1.1, gesture: 0, calculation: 0 },
    });
    assert.equal(r.valid, false);
  });

  test("weights.gesture negative fails", () => {
    const r = validateProportionPayload({
      ...minimal,
      weights: { sound: 0.5, gesture: -0.1, calculation: 0.6 },
    });
    assert.equal(r.valid, false);
  });

  test("cog.x above 1 fails", () => {
    const r = validateProportionPayload({
      ...minimal,
      cog: { x: 1.1, y: 0.5 },
    });
    assert.equal(r.valid, false);
  });

  test("cog.y negative fails", () => {
    const r = validateProportionPayload({
      ...minimal,
      cog: { x: 0.5, y: -0.1 },
    });
    assert.equal(r.valid, false);
  });

  test("sequence.stepIndex negative fails", () => {
    const r = validateProportionPayload({
      ...minimal,
      sequence: { ...minimal.sequence, stepIndex: -1 },
    });
    assert.equal(r.valid, false);
  });

  test("modulation.gains with negative value fails", () => {
    const r = validateProportionPayload({
      ...minimal,
      modulation: {
        gains: { a: -0.5 },
        clamps: { min: 0, max: 1 },
      },
    });
    assert.equal(r.valid, false);
  });
});

// ─── Missing required fields ─────────────────────────────────────────────────

describe("missing required fields", () => {
  const fields: Array<keyof typeof minimal> = [
    "schemaVersion",
    "t",
    "theta",
    "cog",
    "weights",
    "modulation",
    "sequence",
    "metrics",
    "audioDrive",
  ];

  for (const field of fields) {
    test(`missing top-level field '${field}' fails`, () => {
      const payload = { ...minimal };
      delete (payload as any)[field];
      const r = validateProportionPayload(payload);
      assert.equal(r.valid, false);
    });
  }

  test("cog missing 'x' fails", () => {
    const r = validateProportionPayload({
      ...minimal,
      cog: { y: 0.5 } as any,
    });
    assert.equal(r.valid, false);
  });

  test("cog missing 'y' fails", () => {
    const r = validateProportionPayload({
      ...minimal,
      cog: { x: 0.5 } as any,
    });
    assert.equal(r.valid, false);
  });

  test("weights missing 'sound' fails", () => {
    const r = validateProportionPayload({
      ...minimal,
      weights: { gesture: 0.5, calculation: 0.5 } as any,
    });
    assert.equal(r.valid, false);
  });

  test("weights missing 'gesture' fails", () => {
    const r = validateProportionPayload({
      ...minimal,
      weights: { sound: 0.5, calculation: 0.5 } as any,
    });
    assert.equal(r.valid, false);
  });

  test("weights missing 'calculation' fails", () => {
    const r = validateProportionPayload({
      ...minimal,
      weights: { sound: 0.5, gesture: 0.5 } as any,
    });
    assert.equal(r.valid, false);
  });

  test("sequence missing 'id' fails", () => {
    const r = validateProportionPayload({
      ...minimal,
      sequence: { stepIndex: 0, stepName: "n" } as any,
    });
    assert.equal(r.valid, false);
  });

  test("sequence missing 'stepIndex' fails", () => {
    const r = validateProportionPayload({
      ...minimal,
      sequence: { id: "s", stepName: "n" } as any,
    });
    assert.equal(r.valid, false);
  });

  test("sequence missing 'stepName' fails", () => {
    const r = validateProportionPayload({
      ...minimal,
      sequence: { id: "s", stepIndex: 0 } as any,
    });
    assert.equal(r.valid, false);
  });

  test("metrics missing 'raw' fails", () => {
    const r = validateProportionPayload({
      ...minimal,
      metrics: { modulated: { a: 1 } } as any,
    });
    assert.equal(r.valid, false);
  });

  test("metrics missing 'modulated' fails", () => {
    const r = validateProportionPayload({
      ...minimal,
      metrics: { raw: { a: 1 } } as any,
    });
    assert.equal(r.valid, false);
  });

  test("modulation missing 'gains' fails", () => {
    const r = validateProportionPayload({
      ...minimal,
      modulation: { clamps: { min: 0, max: 1 } } as any,
    });
    assert.equal(r.valid, false);
  });

  test("modulation missing 'clamps' fails", () => {
    const r = validateProportionPayload({
      ...minimal,
      modulation: { gains: { a: 1 } } as any,
    });
    assert.equal(r.valid, false);
  });
});

// ─── additionalProperties ────────────────────────────────────────────────────

describe("additionalProperties enforcement", () => {
  test("extra top-level key fails (additionalProperties: false)", () => {
    const r = validateProportionPayload({ ...minimal, extraField: true });
    assert.equal(r.valid, false);
  });

  test("extra key in cog fails", () => {
    const r = validateProportionPayload({
      ...minimal,
      cog: { x: 0.5, y: 0.5, z: 0.1 } as any,
    });
    assert.equal(r.valid, false);
  });

  test("extra key in weights fails", () => {
    const r = validateProportionPayload({
      ...minimal,
      weights: {
        sound: 0.34,
        gesture: 0.33,
        calculation: 0.33,
        rhythm: 0.1,
      } as any,
    });
    assert.equal(r.valid, false);
  });

  test("extra key in sequence fails", () => {
    const r = validateProportionPayload({
      ...minimal,
      sequence: { ...minimal.sequence, extra: "nope" } as any,
    });
    assert.equal(r.valid, false);
  });
});

// ─── validateProportionPayload return shape ───────────────────────────────────

describe("return value shape", () => {
  test("valid result has { valid: true } with no errors key", () => {
    const r = validateProportionPayload(minimal);
    assert.equal(r.valid, true);
    assert.ok(
      !("errors" in r),
      "errors key must not be present on valid result",
    );
  });

  test("invalid result has { valid: false, errors: [...] }", () => {
    const r = validateProportionPayload({ ...minimal, theta: 2 });
    assert.equal(r.valid, false);
    assert.ok("errors" in r && Array.isArray((r as any).errors));
    assert.ok((r as any).errors.length > 0);
  });
});
