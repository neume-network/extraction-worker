//@format
import { workerData, parentPort } from "worker_threads";
import { exit } from "process";

import fastq from "fastq";

import logger from "./logger.mjs";
import { messages } from "./api.mjs";
import { endpointStore, populateEndpointStore } from "./endpoint_store.mjs";

const log = logger("worker");

export function panic(error, message) {
  log(
    `Panic in queue with task "${JSON.stringify(
      message
    )}", error "${error.toString()}"`
  );
  message.error = error.toString();
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

let finished = 0;
let errors = 0;
export function messageHandler(queue) {
  return async (message) => {
    try {
      messages.validate(message);
    } catch (error) {
      return panic(error, message);
    }

    if (message.type === "exit") {
      log(`Received exit signal; shutting down`);
      exit(0);
    } else {
      let result;
      try {
        result = await queue.push(message);
        if (result.error) {
          errors++;
        } else {
          finished++;
        }
        log(`Success: ${finished} Errors: ${errors}`);
      } catch (error) {
        errors++;
        log(`Success: ${finished} Errors: ${errors}`);
        return panic(error, message);
      }

      parentPort.postMessage(result);
    }
  };
}

export function run() {
  log(
    `Starting as worker thread with queue options: "${JSON.stringify(
      workerData.queue.options
    )}`
  );
  if (workerData.endpoints) {
    populateEndpointStore(endpointStore, workerData.endpoints);
  }
  const queue = fastq.promise(
    messages.route,
    workerData.queue.options.concurrent
  );
  parentPort.on("message", messageHandler(queue));
  return queue;
}
