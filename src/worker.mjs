//@format
import { workerData, parentPort } from "worker_threads";
import { exit } from "process";
import Ajv from "ajv";
import addFormats from "ajv-formats";
import { config as configSchema } from "@neume-network/schema";
import fastq from "fastq";

import logger from "./logger.mjs";
import { messages } from "./api.mjs";
import { populateEndpointStore } from "./endpoint_store.mjs";

const log = logger("worker");

export function panic(error, message) {
  log(
    `Panic in queue with task "${JSON.stringify(
      message
    )}", error "${error.toString()}"`
  );
  message.error = error.toString();
  return message;
}

export default function ExtractionWorker(config) {
  let finished = 0;
  let errors = 0;

  validateConfig(config);
  log(`Creating a worker with queue options: "${JSON.stringify(config)}"`);

  const endpointStore = new Map();
  if (config.endpoints) {
    populateEndpointStore(endpointStore, config.endpoints);
  }
  const queue = fastq.promise(
    { endpointStore },
    messages.route,
    config.queue.options.concurrent
  );

  return async function (message) {
    try {
      messages.validate(message);
    } catch (error) {
      return panic(error, message);
    }

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

    return result;
  };
}

export function validateConfig(config) {
  const ajv = new Ajv();
  addFormats(ajv);
  const check = ajv.compile(configSchema);
  const valid = check(config);
  if (!valid) {
    log(check.errors);
    throw new Error("Received invalid config");
  }
}

export function run() {
  const handler = new ExtractionWorker(workerData);
  parentPort.on("message", async (message) => {
    if (message.type === "exit") exit(0);
    const returnMessage = await handler(message);

    parentPort.postMessage(returnMessage);
  });
}
