import { run } from "./src/worker.mjs";
import { Worker, isMainThread, workerData } from "worker_threads";
import { once } from "events";

if (isMainThread) {
  const worker = new Worker(new URL(import.meta.url), {
    workerData: {
      queue: {
        options: {
          concurrent: 1,
        },
      },
      endpoints: {
        "https://httpbin.org": {
          timeout: 5000,
        },
      },
    },
  });
  await once(worker, "online");
  worker.postMessage({
    options: {
      url: "https://httpbin.org/base64/SFRUUEJJTiBpcyBhd2Vzb21l",
      method: "GET",
    },
    version: "0.0.1",
    type: "https",
    commissioner: "index",
    results: null,
    error: null,
  });
  worker.on("message", (m) => {
    console.log(m);
  });
} else {
  run();
}
