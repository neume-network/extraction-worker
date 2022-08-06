# Changelog

## 0.5.1

- Add `endpoints` property that allows setting an endpoint-specific `timeout`
  and rate limit

## 0.5.0

- (breaking) Upon failures in the worker/queue, extraction-worker attempts to
  return as much context back to the user by e.g. sending the augmented message
  object (with the `error` property filled out). This may have been broken in
  earlier versions.

## 0.4.0

- (breaking) Upgrade to eth-fun@0.9.0

## 0.3.2

- Add `eth_getLogs` translation

## 0.3.1

- Properly pass numerical timeout value in milliseconds to `setTimeout`.

## 0.3.0

- (breaking) Pass entire queue `options` configuration through `workerData`.
- (breaking) Make `eth-fun` a peerDependency.
- Through `DEBUG` environment variable, allow inspecting queue's statistics.
- Improve internal error handling.
- Upgrade to @neume-network/message-schema@0.3.1 that includes the `timeout`
  property and implement timeouts with `AbortSignal`.
- Improve error messages for messages of type `https`

## 0.2.0

- Updated to [neume-network/message-schema@0.3.0](https://github.com/neume-network/message-schema/blob/78bb2cc566403d733df20d6c2ab5b86cfcc11e17/changelog.md#030)

## 0.1.0

- Re-release as `@neume-network/extraction-worker`

## 0.0.3

- Upgrade eth-fun@0.6.0

## 0.0.2

- Add `graphql` job type

## 0.0.1

- Initial release
