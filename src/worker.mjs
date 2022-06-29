//@format
import { workerData, parentPort } from "worker_threads";
import { exit } from "process";

import Queue from "better-queue";

import logger from "./logger.mjs";
import { messages } from "./api.mjs";
import { translate } from "./eth.mjs";

const log = logger("worker");

export function panic(taskId, message) {
  const error = message.error.toString();
  log(error);
  parentPort.postMessage({ ...message, error });
}

export function reply(taskId, message) {
  parentPort.postMessage(message);
}

export function messageHandler(queue) {
  return (message) => {
    try {
      messages.validate(message);
    } catch (error) {
      return panic(null, { ...message, error: error.toString() });
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
