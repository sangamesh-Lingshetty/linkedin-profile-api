# LinkedIn Profile API

Small Express API for a hiring assignment that extracts LinkedIn profile experience data.

The implementation directly reproduces LinkedIn's internal server-driven profile requests. No browser automation is used.

## Architecture

```text
src/
  server.js                  Express app bootstrap and POST /api/profile
  linkedin-client.js         Authenticated LinkedIn fetch wrapper and errors
  linkedin-url.js            LinkedIn profile URL validation
  experience.js              Experience endpoint request
  rsc-parser.js              Pragmatic RSC/SDUI text parser
```

## Setup

```bash
npm install
cp .env.example .env
npm run dev
```

Set these values in `.env`:

```text
LINKEDIN_COOKIE=
LINKEDIN_CSRF_TOKEN=
```

Do not commit real LinkedIn cookies or tokens.

## API

```bash
curl -X POST http://localhost:3000/api/profile \
  -H "content-type: application/json" \
  -d '{"profileUrl":"https://www.linkedin.com/in/example/"}'
```

Response:

```json
{
  "profileUrl": "https://www.linkedin.com/in/example/",
  "vanityName": "example",
  "experience": [],
  "meta": {
    "source": "linkedin",
    "partial": true
  }
}
```

## Reverse-Engineering Approach

This first phase calls only the verified internal endpoint:

```text
POST https://www.linkedin.com/flagship-web/in/{vanityName}/details/experience/
```

The response is handled as text because LinkedIn returns serialized RSC/SDUI data, not ordinary JSON. The parser is intentionally pragmatic and extracts stable profile-experience signals rather than implementing a full React Server Components parser.

## Limitations

Only Experience is implemented. Education, Skills, Certifications, Languages and basic profile details are intentionally out of scope until Experience is confirmed working.
