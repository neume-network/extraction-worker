//@format
import {
  call,
  blockNumber,
  getBlockByNumber,
  getTransactionReceipt,
  getLogs,
} from "eth-fun";
import retry from "async-retry";

import { NotImplementedError } from "./errors.mjs";

// NOTE: `AbortSignal.timeout` isn't yet supported:
// https://github.com/mysticatea/abort-controller/issues/35
export const AbortSignal = {
  timeout: function (value) {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), value);
    return controller.signal;
  },
};

export async function translate(options, method, params) {
  return retry(async (bail) => {
    if (options.timeout) {
      options.signal = AbortSignal.timeout(
        options.timeout ?? timeoutFromConfig
      );
      delete options.timeout;
    }

    if (method === "eth_getTransactionReceipt") {
      return await getTransactionReceipt(options, params[0]);
    } else if (method === "eth_getBlockByNumber") {
      // NOTE: `getBlockByNumber` expects the `blockNumber` input to be an
      // hexadecimal (`0x...`) value.
      return await getBlockByNumber(options, ...params);
    } else if (method === "eth_blockNumber") {
      return await blockNumber(options);
    } else if (method === "eth_call") {
      const { from, to, data } = params[0];
      return await call(options, from, to, data, params[1]);
    } else if (method === "eth_getLogs") {
      const { fromBlock, toBlock, address, topics, limit } = params[0];
      return await getLogs(options, {
        fromBlock,
        toBlock,
        address,
        topics,
        limit,
      });
    } else {
      bail(new NotImplementedError());
    }
  });
}
