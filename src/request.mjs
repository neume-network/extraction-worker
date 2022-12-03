import fetch from "cross-fetch";
import retry from "async-retry";

export async function request(
  url,
  method,
  body,
  headers,
  signal,
  retryConfig = { retries: 0 }
) {
  return retry(async (bail) => {
    let options = {
      method,
    };

    if (body) {
      options.body = body;
    }
    if (headers) {
      options.headers = headers;
    }
    if (signal) {
      options.signal = signal;
    }

    // NOTE: We let `fetch` throw. Error must be caught on `request` user level.
    const results = await fetch(url, options);
    const answer = await results.text();

    if (results.status === 429) {
      throw new Error(
        `Request to url "${url}" with method "${method}" and body "${JSON.stringify(
          body
        )}" unsuccessful with status: ${results.status} and answer: "${answer}"`
      );
    }

    if (results.status >= 400) {
      bail(
        new Error(
          `Request to url "${url}" with method "${method}" and body "${JSON.stringify(
            body
          )}" unsuccessful with status: ${
            results.status
          } and answer: "${answer}"`
        )
      );
      return;
    }

    try {
      return JSON.parse(answer);
    } catch (err) {
      if (results.headers.get("Content-Type")?.toLowerCase().includes("json")) {
        bail(
          new Error(
            `Encountered error when trying to parse JSON body result: "${answer}", error: "${err.toString()}"`
          )
        );
        return;
      }

      return answer;
    }
  }, retryConfig);
}
