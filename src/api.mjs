// @format
import Ajv from "ajv";
import {
  exit as exitMsg,
  https,
  jsonrpc,
  graphql,
} from "@neume-network/message-schema";
import AbortController from "abort-controller";

import logger from "./logger.mjs";
import { ValidationError, NotImplementedError } from "./errors.mjs";
import { translate } from "./eth.mjs";
import { endpointStore } from "./endpoint_store.mjs";
import { request } from "./request.mjs";

const log = logger("api");
const ajv = new Ajv();
const version = "0.0.1";

const schema = {
  oneOf: [graphql, jsonrpc, exitMsg, https],
};

const check = ajv.compile(schema);
function validate(value) {
  const valid = check(value);
  if (!valid) {
    log(check.errors);
    throw new ValidationError(
      "Found 1 or more validation error when checking worker message"
    );
  }

  if (value.version !== version) {
    throw new ValidationError(
      `Difference in versions. Worker: "${version}", Message: "${value.version}"`
    );
  }

  return true;
}

// NOTE: `AbortSignal.timeout` isn't yet supported:
// https://github.com/mysticatea/abort-controller/issues/35
export const AbortSignal = {
  timeout: function (value) {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), value);
    return controller.signal;
  },
};

async function route(message) {
  const { type } = message;

  if (type === "json-rpc") {
    const { method, params, options } = message;

    const { origin } = new URL(options.url);
    const { rateLimiter, timeout: timeoutFromConfig } =
      endpointStore.get(origin) ?? {};
    if (rateLimiter) {
      await rateLimiter.removeTokens(1);
    }

    if (options.timeout || timeoutFromConfig) {
      options.signal = AbortSignal.timeout(
        options.timeout ?? timeoutFromConfig
      );
      delete options.timeout;
    }

    let results;
    try {
      results = await translate(options, method, params);
    } catch (error) {
      return { ...message, error: error.toString() };
    }

    return { ...message, results };
  } else if (type === "https") {
    const {
      url,
      method,
      body,
      headers,
      timeout: timeoutFromMsg,
    } = message.options;

    const { origin } = new URL(url);
    const { rateLimiter, timeout: timeoutFromConfig } =
      endpointStore.get(origin) ?? {};
    if (rateLimiter) {
      await rateLimiter.removeTokens(1);
    }

    let signal;
    if (timeoutFromMsg || timeoutFromConfig) {
      signal = AbortSignal.timeout(timeoutFromMsg ?? timeoutFromConfig);
    }

    let data;
    try {
      data = await request(url, method, body, headers, signal);
    } catch (error) {
      return { ...message, error: error.toString() };
    }
    return { ...message, results: data };
  } else if (type === "arweave") {
    const { uri, timeout: timeoutFromMsg } = message.options;

    const ARWEAVE = "https://arweave.net";
    const url = `${ARWEAVE}/${uri.split("://").pop()}`;
    const method = "GET";

    const { origin } = new URL(url);
    const { rateLimiter, timeout: timeoutFromConfig } =
      endpointStore.get(origin) ?? {};
    if (rateLimiter) {
      await rateLimiter.removeTokens(1);
    }

    let signal;
    if (timeoutFromMsg || timeoutFromConfig) {
      signal = AbortSignal.timeout(timeoutFromMsg ?? timeoutFromConfig);
    }

    let data;
    try {
      data = await request(url, method, null, null, signal);
    } catch (error) {
      return { ...message, error: error.toString() };
    }
    return { ...message, results: data };
  } else if (type === "graphql") {
    const { url, body, headers } = message.options;
    const method = "POST";

    let data;
    try {
      data = await request(url, method, body, headers);
    } catch (error) {
      return { ...message, error: error.toString() };
    }

    if (data.errors) {
      // NOTE: For now, we're only returning the first error message.
      return { ...message, error: data.errors[0].message };
    }

    return { ...message, results: data };
  } else {
    return { ...message, error: new NotImplementedError().toString() };
  }
}

export const messages = {
  schema,
  route,
  validate,
  version,
};
