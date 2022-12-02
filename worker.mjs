import ExtractionWorker from "./src/worker.mjs";

const worker = new ExtractionWorker({
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
});

const res = await worker({
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

console.log(res);
