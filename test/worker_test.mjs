//@format
import test from "ava";
import esmock from "esmock";

import Queue from "better-queue";

import { messages } from "../src/api.mjs";
import { loggingProxy } from "../src/worker.mjs";

test("the case that panic function is called without context", async (t) => {
  const taskId = "taskId";
  const error = new Error("error");
  const stats = "stats";
  t.plan(1);
  const { panic } = await esmock("../src/worker.mjs", null, {
    worker_threads: {
      parentPort: {
        postMessage: (message) => {
          t.is(message, error.toString());
        },
      },
      workerData: {},
    },
  });
  panic(taskId, error, stats);
});

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
  t.true(queue instanceof Queue);
});

test("logging proxy", (t) => {
  t.plan(3);
  const taskId = "id";
  const message = "message";
  const handlerMock = (arg1, arg2) => {
    t.is(taskId, arg1);
    t.is(message, arg2);
  };
  const queueMock = {
    getStats: () => {
      t.true(true);
      return "test value";
    },
  };

  loggingProxy(queueMock, handlerMock)(taskId, message);
});

test("throw on invalidly formatted message", async (t) => {
  t.plan(2);
  const workerMock = await esmock("../src/worker.mjs", null, {
    worker_threads: {
      parentPort: {
        postMessage: (message) => {
          t.is(message.hello, "world");
          t.true(
            message.error.includes("ValidationError"),
            `Unexpected content of message.error: ${message.error}`
          );
        },
      },
      workerData: {
        concurrency: 1,
      },
    },
  });

  const message = {
    hello: "world",
  };
  workerMock.messageHandler({})(message);
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
