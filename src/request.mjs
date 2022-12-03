import fetch from "cross-fetch";
import retry from "async-retry";

export async function request(url, method, body, headers, signal) {
  return retry(
    async (bail) => {
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

      if (results.status === 403 || results.status === 404) {
        bail(
          new Error(
            `Request to url "${url}" with method "${method}" and body "${JSON.stringify(
              body
            )}" unsuccessful with status: ${
              results.status
            } and answer: "${answer}"`
          )
        );
      }

      try {
        return JSON.parse(answer);
      } catch (err) {
        if (
          results.headers.get("Content-Type")?.toLowerCase().includes("json")
        ) {
          bail(
            new Error(
              `Encountered error when trying to parse JSON body result: "${answer}", error: "${err.toString()}"`
            )
          );
        }

        return answer;
      }
    },
    // TODO: Make this configurable
    { retries: 5 }
  );
}
