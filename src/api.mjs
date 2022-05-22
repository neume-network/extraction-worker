// @format
import { exit } from "process";

import Ajv from "ajv";
import fetch from "cross-fetch";
import {
  exit as exitMsg,
  https,
  jsonrpc,
  graphql,
} from "@neume-network/message-schema";

import logger from "./logger.mjs";
import { ValidationError, NotImplementedError } from "./errors.mjs";
import { translate } from "./eth.mjs";

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

async function request(url, method, body, headers) {
  let options = {
    method,
  };

  if (body) {
    options.body = body;
  }
  if (headers) {
    options.headers = headers;
  }

  // NOTE: We let `fetch` throw. Error must be caught on `request` user level.
  const results = await fetch(url, options);

  if (results.status >= 400) {
    throw new Error(`Request unsuccessful with status: ${results.status}`);
  }

  // TODO: Invalid assumption here: JSON parsing should only happen when
  // respective accept header is set.
  return await results.json();
}

async function route(message, cb) {
  const { type } = message;

  if (type === "json-rpc") {
    const { method, params, options } = message;
    log(`Calling JSON-RPC endpoint with method: ${method}`);
    let results;

    try {
      results = await translate(options, method, params);
    } catch (error) {
      return cb({ ...message, error: error.toString() });
    }

    return cb(null, { ...message, results });
  } else if (type === "https") {
    const { url, method, body, headers } = message.options;
    let data;

    try {
      data = await request(url, method, body, headers);
    } catch (error) {
      return cb({ ...message, error: error.toString() });
    }
    return cb(null, { ...message, results: data });
  } else if (type === "graphql") {
    const { url, body, headers } = message.options;
    const method = "POST";

    let data;
    try {
      data = await request(url, method, body, headers);
    } catch (error) {
      return cb({ ...message, error: error.toString() });
    }

    if (data.errors) {
      // NOTE: For now, we're only returning the first error message.
      return cb({ ...message, error: data.errors[0].message });
    }

    return cb(null, { ...message, results: data });
  } else {
    return cb({ ...message, error: new NotImplementedError().toString() });
  }
}

export const messages = {
  schema,
  route,
  validate,
  version,
};
