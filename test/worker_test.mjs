//@format
import test from "ava";
import esmock from "esmock";

import fastq from "fastq";

import { messages } from "../src/api.mjs";

test("if run returns queue instance", async (t) => {
  const workerData = {
    queue: {
      options: {
        concurrency: 1,
      },
    },
  };
  const { run } = await esmock("../src/worker.mjs", null, {
    worker_threads: {
      parentPort: {
        on: () => {}, // noop
        postMessage: () => {}, // noop
      },
      workerData,
    },
  });
  const queue = run();
  t.truthy(queue.concurrency);
  t.truthy(queue.getQueue);
});

test("throw on invalidly formatted message", async (t) => {
  t.plan(2);
  const workerMock = await esmock("../src/worker.mjs", null, {
    worker_threads: {
      parentPort: {
        on: () => {}, // noop
        postMessage: (message) => {
          t.is(message.hello, "world");
          t.true(
            message.error.includes("ValidationError"),
            `Unexpected content of message.error: ${message.error}`
          );
        },
      },
      workerData: {
        queue: {
          options: {
            concurrency: 1,
          },
        },
      },
    },
  });

  const message = {
    hello: "world",
  };
  const queue = workerMock.run();
  workerMock.messageHandler(queue)(message);
});

test("call exit", async (t) => {
  t.plan(1);
  const workerMock = await esmock("../src/worker.mjs", null, {
    process: {
      exit: () => t.true(true),
    },
  });

  workerMock.messageHandler()({
    type: "exit",
    version: messages.version,
  });
});
