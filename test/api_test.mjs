//@format
import { env } from "process";

import test from "ava";
import esmock from "esmock";
import createWorker from "expressively-mocked-fetch";

import { request, messages, AbortSignal } from "../src/api.mjs";
import { ValidationError } from "../src/errors.mjs";

test("sending a json-rpc request that times out", async (t) => {
  const pauseMilliseconds = 1000;
  const worker = await createWorker(
    `
    app.post('/', async (req, res) => {
      res.status(200).send("hello world");
    });
  `,
    { pauseMilliseconds }
  );

  const timeoutMilliseconds = 500;
  const message = {
    options: {
      timeout: timeoutMilliseconds,
      url: `http://localhost:${worker.port}`,
    },
    version: messages.version,
    type: "json-rpc",
    method: "eth_getTransactionReceipt",
    params: [
      "0xed14c3386aea0c5b39ffea466997ff13606eaedf03fe7f431326531f35809d1d",
    ],
    results: null,
    error: null,
  };

  t.plan(3);
  const cb = (err, response) => {
    t.truthy(err);
    t.true(err.error.includes("AbortError"));
    t.falsy(response);
  };
  await messages.route(message, cb);
});

test("sending an https request that times out", async (t) => {
  const pauseMilliseconds = 1000;
  const worker = await createWorker(
    `
    app.get('/', async (req, res) => {
      res.status(200).send("hello world");
    });
  `,
    { pauseMilliseconds }
  );

  const timeoutMilliseconds = 500;
  const message = {
    type: "https",
    version: messages.version,
    options: {
      timeout: timeoutMilliseconds,
      url: `http://localhost:${worker.port}`,
      method: "GET",
    },
    results: null,
    error: null,
  };

  t.plan(3);
  const cb = (err, response) => {
    t.truthy(err);
    t.true(err.error.includes("AbortError"));
    t.falsy(response);
  };
  await messages.route(message, cb);
});

test("setting a timeout that isn't triggered", async (t) => {
  const timeout = 1000;
  const signal = AbortSignal.timeout(timeout);
  t.plan(1);
  let called = false;
  signal.addEventListener("abort", () => {
    called = true;
  });
  await new Promise((resolve) => setTimeout(resolve, timeout - timeout / 2));
  t.false(called);
});

test("setting a timeout", async (t) => {
  const timeout = 100;
  const signal = AbortSignal.timeout(timeout);
  t.plan(1);
  let called = false;
  signal.addEventListener("abort", () => {
    called = true;
  });
  await new Promise((resolve) => setTimeout(resolve, timeout + 5));
  t.true(called);
});

test("sending a graphql message", (t) => {
  const message = {
    type: "graphql",
    version: messages.version,
    commissioner: "soundxyz",
    options: {
      url: "https://example.com",
      body: JSON.stringify({
        query: `{ nfts(first: 1, skip: 0) { id } }`,
      }),
    },
    results: null,
    error: null,
  };

  t.true(messages.validate(message));
});

test("sending invalid json as response", async (t) => {
  const worker = await createWorker(`
    app.get('/', function (req, res) {
      res.status(200).send("hello world");
    });
  `);
  const message = {
    type: "https",
    version: messages.version,
    options: {
      url: `http://localhost:${worker.port}`,
      method: "GET",
    },
    results: null,
    error: null,
  };

  t.plan(3);
  const cb = (err, response) => {
    t.true(err.error.includes("Encountered error when trying to parse"));
    t.falsy(response);
    t.truthy(err);
  };
  await messages.route(message, cb);
});

test("failing https request with status and body", async (t) => {
  const httpStatus = 401;
  const httpMessage = "bad request";
  const worker = await createWorker(`
    app.get('/', function (req, res) {
      res.status(${httpStatus}).send("${httpMessage}");
    });
  `);
  const message = {
    type: "https",
    version: messages.version,
    options: {
      url: `http://localhost:${worker.port}`,
      method: "GET",
    },
    results: null,
    error: null,
  };

  t.plan(6);
  const cb = (err, response) => {
    t.true(err.error.includes(message.options.url));
    t.true(err.error.includes(message.options.method));
    t.true(err.error.includes(httpMessage));
    t.true(err.error.includes(httpStatus));
    t.falsy(response);
    t.truthy(err);
  };
  await messages.route(message, cb);
});

test("failing https request with status", async (t) => {
  const httpStatus = 401;
  const worker = await createWorker(`
    app.get('/', function (req, res) {
      res.status(${httpStatus}).send();
    });
  `);
  const message = {
    type: "https",
    version: messages.version,
    options: {
      url: `http://localhost:${worker.port}`,
      method: "GET",
    },
    results: null,
    error: null,
  };

  t.plan(3);
  const cb = (err, response) => {
    t.true(err.error.includes(httpStatus));
    t.falsy(response);
    t.truthy(err);
  };
  await messages.route(message, cb);
});

// TODO: Sandbox request with fetchMock
test("failing https request", async (t) => {
  const message = {
    type: "https",
    version: messages.version,
    options: {
      url: "https://thisdomaindoesntrespond.com",
      method: "GET",
    },
    results: null,
    error: null,
  };

  t.plan(3);
  const cb = (err, response) => {
    t.true(err.error.includes("FetchError"));
    t.falsy(response);
    t.truthy(err);
  };
  await messages.route(message, cb);
});

// TODO: Sandbox request with fetchMock
test("executing https job", async (t) => {
  const message = {
    type: "https",
    version: messages.version,
    options: {
      url: "https://api.thegraph.com/subgraphs/name/timdaub/web3musicsubgraph",
      method: "POST",
      body: JSON.stringify({
        query: `{ nfts(first: 1000) { id } }`,
      }),
    },
    results: null,
    error: null,
  };

  t.plan(4);
  const cb = (err, response) => {
    t.truthy(response);
    t.truthy(response.results.data);
    t.truthy(response.results.data.nfts);
    t.true(response.results.data.nfts.length > 0);
  };
  await messages.route(message, cb);
});

test("fail to execute a graphql job", async (t) => {
  const message = {
    type: "graphql",
    version: messages.version,
    options: {
      url: "https://api.thegraph.com/subgraphs/name/timdaub/web3musicsubgraph",
      body: JSON.stringify({
        query: `nonsense query`,
      }),
    },
    results: null,
    error: null,
  };

  t.plan(3);
  const cb = (err, response) => {
    t.falsy(response);
    t.true(typeof err.error === "string");
    t.truthy(err);
  };
  await messages.route(message, cb);
});

test("executing a graphql job", async (t) => {
  const message = {
    type: "graphql",
    version: messages.version,
    options: {
      url: "https://api.thegraph.com/subgraphs/name/timdaub/web3musicsubgraph",
      body: JSON.stringify({
        query: `{ nfts(first: 1000) { id } }`,
      }),
    },
    results: null,
    error: null,
  };

  t.plan(5);
  const cb = (err, response) => {
    t.falsy(err);
    t.truthy(response);
    t.truthy(response.results.data);
    t.truthy(response.results.data.nfts);
    t.true(response.results.data.nfts.length > 0);
  };
  await messages.route(message, cb);
});

test("validating version of message", (t) => {
  messages.validate({ type: "exit", version: messages.version });
  t.throws(() => messages.validate({ type: "exit", version: "1337.0.0" }));
});

test("validating schema `type` prop", (t) => {
  const message0 = {
    type: "exit",
    version: messages.version,
  };
  t.true(messages.validate(message0));

  const message1 = {
    type: "false type",
    version: messages.version,
  };
  t.throws(() => messages.validate(message1), { instanceOf: ValidationError });

  const message2 = {
    options: {
      url: env.RPC_HTTP_HOST,
    },
    commissioner: "soundxyz",
    version: messages.version,
    type: "json-rpc",
    method: "eth_getBlockByNumber",
    params: [],
    results: null,
  };
  t.true(messages.validate(message2));
});

test("validating http job schema", (t) => {
  const message = {
    type: "https",
    commissioner: "soundxyz",
    version: "0.0.1",
    options: {
      url: "https://example.com",
      method: "GET",
    },
    results: null,
    error: null,
  };

  t.true(messages.validate(message));
});

test("sending a json-rpc job", async (t) => {
  const message = {
    options: {
      url: env.RPC_HTTP_HOST,
    },
    version: messages.version,
    type: "json-rpc",
    method: "eth_getTransactionReceipt",
    params: [
      "0xed14c3386aea0c5b39ffea466997ff13606eaedf03fe7f431326531f35809d1d",
    ],
    results: null,
  };

  t.plan(2);
  const cb = (err, res) => {
    t.falsy(err);
    t.truthy(res);
  };
  await messages.route(message, cb);
});

test("handling failed job", async (t) => {
  const apiMock = await esmock("../src/api.mjs", {
    "../src/eth.mjs": {
      translate: async () => {
        throw new Error("MockError");
      },
    },
  });

  const message = {
    options: {
      url: env.RPC_HTTP_HOST,
    },
    version: apiMock.messages.version,
    type: "json-rpc",
    method: "eth_getTransactionReceipt",
    params: [
      "0xed14c3386aea0c5b39ffea466997ff13606eaedf03fe7f431326531f35809d1d",
    ],
    results: null,
  };

  const cb = async (err, res) => {
    t.truthy(err);
    t.falsy(res);
  };
  await apiMock.messages.route(message, cb);
});
