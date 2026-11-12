# Shared AI backend

`worker.mjs` is a small Cloudflare Worker that lets people use ProductLab's AI features without a key of their own. The website sends its Gemini requests to the Worker, and the Worker adds the team's Gemini key, which is stored as a Cloudflare secret. The key never appears in the browser, the website's code or this repository.

## What it allows

- Requests only from the ProductLab site (`https://ashkapathak.github.io` by default).
- Only text generation with `gemini-3.5-flash-lite`, `gemini-3.8-flash` or `gemini-3.6-flash`; no search grounding and no other Gemini APIs.
- Requests up to 120 KB and answers up to 4,096 tokens.
- Per visitor (IP address): 12 requests a minute and 120 an hour. These limits are kept in memory, so they slow abuse rather than guarantee an exact count.

Everyone shares the key's free Gemini quota, which resets at midnight US Pacific time. When it runs out, the app tells people they can add their own free key in Settings.

## Deploy (about 10 minutes, free)

1. Create a free account at [dash.cloudflare.com](https://dash.cloudflare.com/sign-up).
2. In the dashboard, open **Workers & Pages**, choose **Create**, then **Create Worker** (start from "Hello World"), name it `productlab-ai` and deploy it.
3. Choose **Edit code**, replace everything with the contents of `worker.mjs`, and press **Deploy**.
4. Open the Worker's **Settings → Variables and Secrets**, add a variable of type **Secret** named `GEMINI_API_KEY`, paste the Gemini key from [Google AI Studio](https://aistudio.google.com/app/apikey), and deploy.
5. Open the Worker's address (for example `https://productlab-ai.<your-subdomain>.workers.dev`). It should show `"ok": true` and `"keyConfigured": true`.
6. Put that address in `js/app/config.js` as `sharedAI`, commit and push. The site then uses the shared AI by default.

To allow another site (for example a local test server), add a plain variable `ALLOWED_ORIGINS` with a comma-separated list of origins, such as `https://ashkapathak.github.io,http://localhost:8000`.

## Tests

`tests/proxy.test.js` checks that the Worker forwards with the server key, strips search grounding, caps output, refuses other sites, models and endpoints, limits each visitor, and never sends the key back.
