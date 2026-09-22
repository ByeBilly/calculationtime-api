# CalculationTime API Beginner Gateway

This page is for people who have never used an API before.

You do not need to be a professional developer to make a useful API call. An API is just a structured way to ask a service for an answer. You send a request. The API sends back data.

The goal of this guide is one small win: make your first CalculationTime API call, see the answer, and understand what happened.

## Your First API Call

Copy this into a browser address bar:

```text
https://api.calculationtime.com/v1/time/utc
```

You should see a JSON response. JSON is just structured text that computers can read easily.

It will look roughly like this:

```json
{
  "utc_time": "2026-09-22T14:30:00.000Z",
  "unix_seconds": 1789991400,
  "unix_milliseconds": 1789991400000,
  "accuracy_model": {
    "scale": "UTC",
    "source": "server_clock"
  }
}
```

That is it. You have used an API.

You asked CalculationTime for the current UTC time. It answered with structured data instead of a normal webpage.

## What Just Happened

- `https://api.calculationtime.com` is the API base URL.
- `/v1/time/utc` is the endpoint, meaning the specific question you asked.
- The response is JSON, meaning the answer is arranged as named fields.
- No API key was needed because this is a public demo endpoint.

## Try A Useful Public Lookup

Reference-data endpoints are public and beginner-safe. They are good for learning because you can call them in a browser.

Search country data:

```text
https://api.calculationtime.com/v1/data/countries?q=australia
```

Search material densities:

```text
https://api.calculationtime.com/v1/data/materials/density?q=steel
```

Look up an HTTP status code:

```text
https://api.calculationtime.com/v1/data/http-status?q=429
```

If you can change the text after `q=`, you can already customize an API request.

## How To Read An API URL

This URL:

```text
https://api.calculationtime.com/v1/data/countries?q=australia
```

Breaks down like this:

| Part | Meaning |
|---|---|
| `https://api.calculationtime.com` | The CalculationTime API home |
| `/v1/data/countries` | The endpoint you are asking |
| `?q=australia` | A query parameter, like filling in a search box |

Query parameters are just inputs in the URL. They usually come after `?`.

## What Is An API Key?

Some endpoints need an API key. That key tells the service who is calling and helps protect the API from abuse.

An API key is not a password for a website login, but you should still keep it private.

Beginner rule:

- Public demo and reference endpoints: no key needed.
- Calculation endpoints: key usually needed.
- Never paste a real key into public code, screenshots, docs, forum posts, or client-side browser JavaScript.

When a key is needed, the safest beginner pattern is:

```bash
export CALCULATIONTIME_API_KEY='ct_live_your_key_here'
curl 'https://api.calculationtime.com/v1/canary' \
  -H "Authorization: Bearer $CALCULATIONTIME_API_KEY"
```

If that looks unfamiliar, do not worry. Start with the public browser examples first.

## Beginner-Friendly Things To Build

These are useful first projects because the result is easy to understand:

| Beginner project | Useful endpoint family |
|---|---|
| Show current UTC time | `/v1/time/utc` |
| Search country data | `/v1/data/countries` |
| Find material density | `/v1/data/materials/density` |
| Explain HTTP errors | `/v1/data/http-status` |
| Convert dates and deadlines | `/v1/date/...` |
| Count business days | `/v1/date/business-days` |
| Convert units | `/api/v1/convert/...` |
| Encode or decode Base64 | `/api/v1/crypto/base64-...` |
| Calculate loan or margin figures | `/api/v1/finance/...` |
| Calculate BMI or pace | `/v1/health/...` |

Start with public endpoints. Move to key-protected endpoints once the request and response pattern feels normal.

## The Confidence Ladder

Use this order if APIs still feel complicated:

1. Open `/v1/time/utc` in a browser.
2. Change a search value in a public reference URL.
3. Copy a `curl` example and run it in a terminal.
4. Try one protected endpoint with an API key.
5. Use the same endpoint from JavaScript, Python, Make, Zapier, or another tool.
6. Build a tiny form that sends inputs to the API and shows the response.

Do not start with the full OpenAPI contract. That is the complete machine-readable map for developers. It is useful later, but it is not the best first five minutes.

## Copy-Paste Examples

### Browser

```text
https://api.calculationtime.com/v1/time/utc
```

### curl

```bash
curl 'https://api.calculationtime.com/v1/time/utc'
```

### JavaScript

```js
const response = await fetch('https://api.calculationtime.com/v1/time/utc');
const data = await response.json();

console.log(data.utc_time);
```

### Python

```python
import requests

response = requests.get("https://api.calculationtime.com/v1/time/utc", timeout=10)
data = response.json()

print(data["utc_time"])
```

## Good API Learning Rule

You do not need to understand every endpoint to use one endpoint well.

Pick one small job. Make one request. Read one response. Then build from there.

That is how API confidence grows.
