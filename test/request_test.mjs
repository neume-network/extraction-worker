import test from "ava";
import esmock from "esmock";
import createWorker from "expressively-mocked-fetch";
import AbortController from "abort-controller";
import { Response } from "cross-fetch";

import { request } from "../src/request.mjs";

test("should be able to parse if content-type is json and body is parsable", async (t) => {
  const worker = await createWorker(
    `
    app.get('/', async (req, res) => {
      res.status(200).set('Content-Type', 'application/json').json({hello: "world"});
    });
  `
  );

  const res = await request(`http://localhost:${worker.port}`, "GET");
  t.deepEqual(res, { hello: "world" });
  worker.process.terminate();
});

test("should be able to parse if content-type is undefined and body is parsable", async (t) => {
  const worker = await createWorker(
    `
    app.get('/', async (req, res) => {
      res.status(200).json({hello: "world"});
    });
  `
  );

  const res = await request(`http://localhost:${worker.port}`, "GET");

  t.deepEqual(res, { hello: "world" });
  worker.process.terminate();
});

test("should not be able to parse if content-type is json and body is unparsable", async (t) => {
  const worker = await createWorker(
    `
    app.get('/', async (req, res) => {
      res.status(200).set('Content-Type', 'application/json').send('hello');
    });
  `
  );

  await t.throwsAsync(
    async () => request(`http://localhost:${worker.port}`, "GET"),
    {
      message:
        'Encountered error when trying to parse JSON body result: "hello", error: "SyntaxError: Unexpected token h in JSON at position 0"',
    }
  );
  worker.process.terminate();
});

test("should return plaintext if content-type is undefined and body is not parsable", async (t) => {
  const worker = await createWorker(
    `
    app.get('/', async (req, res) => {
      res.status(200).send('hello');
    });
  `
  );

  const res = await request(`http://localhost:${worker.port}`, "GET");
  t.is(res, "hello");
  worker.process.terminate();
});

test("should retry on status 429", async (t) => {
  const retries = 3;
  const requestCount = retries + 1;
  const worker = await createWorker(
    `
    let i = 0;
    app.get('/', async (req, res) => {
      res.status(++i < ${requestCount} ? 429 : 200).send(i.toString());
    });
  `,
    {
      requestCount,
    }
  );
  const body = null;
  const headers = null;
  const signal = new AbortController().signal;
  const res = await request(
    `http://localhost:${worker.port}`,
    "GET",
    body,
    headers,
    signal,
    {
      retries,
    }
  );
  t.is(res, requestCount);
  worker.process.terminate();
});

test("should not retry on non status 429", async (t) => {
  const worker = await createWorker(
    `
    let i = 0;
    app.get('/', async (req, res) => {
      res.status(400).send((++i).toString());
    });
  `
  );
  const body = null;
  const headers = null;
  await t.throwsAsync(async () => {
    const res = await request(
      `http://localhost:${worker.port}`,
      "GET",
      body,
      headers,
      null,
      {
        retries: 3,
      }
    );
    t.is(res, 1);
  });
  worker.process.terminate();
});

test("should retry on network error", async (t) => {
  const retries = 3;
  let requestCount = 0;
  const { request } = await esmock("../src/request.mjs", null, {
    "cross-fetch": {
      default: () => {
        if (++requestCount < retries + 1) throw new Error("NetworkError");
        return new Response(requestCount);
      },
    },
  });

  const body = null;
  const headers = null;
  const signal = null;
  const res = await request(
    `http://localhost:32893`,
    "GET",
    body,
    headers,
    signal,
    {
      retries,
    }
  );
  t.is(res, retries + 1);
});
