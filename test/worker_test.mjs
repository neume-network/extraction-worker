//@format
import test from "ava";

import ExtractionWorker, { validateConfig } from "../src/worker.mjs";

const mockConfig = {
  queue: {
    options: {
      concurrent: 1,
    },
  },
};

test("throw on invalidly formatted message", async (t) => {
  const handler = new ExtractionWorker(mockConfig);
  const message = {
    hello: "world",
  };
  const ret = await handler(message);
  t.is(ret.hello, "world");
  t.true(
    ret.error.includes("ValidationError"),
    `Unexpected content of message.error: ${message.error}`
  );
});

test("validateConfig should not throw error for valid config", (t) => {
  t.notThrows(() =>
    validateConfig({
      queue: {
        options: {
          concurrent: 10,
        },
      },
    })
  );
});

test("validateConfig should throw error for invalid config", (t) => {
  t.throws(() =>
    validateConfig({
      queue: { options: "" },
    })
  );
});
