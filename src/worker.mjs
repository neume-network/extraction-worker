//@format
import { workerData, parentPort } from "worker_threads";
import { exit } from "process";

import Queue from "better-queue";

import logger from "./logger.mjs";
import { messages } from "./api.mjs";
import { translate } from "./eth.mjs";

const log = logger("worker");

export function panic(taskId, error, stats) {
  // NOTE: See: https://github.com/diamondio/better-queue/issues/82
  let message;
  if (error && error instanceof Error) {
    message = error.toString();
  } else if (error && error instanceof Object) {
    message = { ...error };
  }
  log(
    `Panic in queue with taskId "${taskId}", error "${JSON.stringify(
      message
    )}" and stats "${JSON.stringify(stats)}"`
  );
  if (message) {
    parentPort.postMessage(message);
  } else {
    // TODO: Need to get the context of where that error was thrown, e.g. can
    // we get the task's message through `taskId` somehow? Otherwise,
    // how useful is it to throw this error outside and which message schema
    // should it be?
    log("WARNING: Error isn't propagated outside of extration worker");
  }
}

export function reply(taskId, message) {
  parentPort.postMessage(message);
}

export function messageHandler(queue) {
  return (message) => {
    try {
      messages.validate(message);
    } catch (error) {
      return panic("no-task-id-error-thrown-from-messageHandler", {
        ...message,
        error: error.toString(),
      });
    }

    if (message.type === "exit") {
      log(`Received exit signal; shutting down`);
      exit(0);
    } else {
      queue.push(message);
    }
  };
}

export function loggingProxy(queue, handler) {
  return (...args) => {
    log(`Queue stats: ${JSON.stringify(queue.getStats())}`);
    return handler(...args);
  };
}

export function run() {
  log(
    `Starting as worker thread with queue options: "${JSON.stringify(
      workerData.queue.options
    )}`
  );
  const queue = new Queue(messages.route, workerData.queue.options);
  queue.on("task_finish", loggingProxy(queue, reply));
  queue.on("task_failed", loggingProxy(queue, panic));
  parentPort.on("message", messageHandler(queue));
  return queue;
}
