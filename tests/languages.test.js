import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { getLanguages } from "../src/languages.js";
import {
  extractLanguagesProfileId,
  extractNextLanguagesStart,
  parseLanguages
} from "../src/rsc-parser.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

test("extracts languages profileId", () => {
  const raw = readFixture("languages-screen-rsc.txt");

  assert.equal(extractLanguagesProfileId(raw), "ACoAAALanguagesExample123");
});

test("empty language profile returns empty array", () => {
  const raw = readFixture("languages-empty-rsc.txt");

  assert.deepEqual(parseLanguages(raw), []);
});

test("parses a single language with proficiency", () => {
  const raw = [
    '1:{"children":["Languages"]}',
    '2:["$","div",null,{"children":["$L3","$L4"]}]',
    '3:{"children":["English"]}',
    '4:{"children":["Professional working proficiency"]}'
  ].join("\n");

  assert.deepEqual(parseLanguages(raw), [
    {
      name: "English",
      proficiency: "Professional working proficiency"
    }
  ]);
});

test("parses language without proficiency", () => {
  const raw = [
    '1:{"children":["Languages"]}',
    '2:["$","div",null,{"children":["$L3"]}]',
    '3:{"children":["Kannada"]}'
  ].join("\n");

  assert.deepEqual(parseLanguages(raw), [
    {
      name: "Kannada",
      proficiency: null
    }
  ]);
});

test("parses multiple language rows without leaking proficiency", () => {
  const raw = readFixture("languages-pagination-page-1-rsc.txt");

  assert.deepEqual(parseLanguages(raw), [
    {
      name: "English",
      proficiency: "Professional working proficiency"
    },
    {
      name: "Kannada",
      proficiency: null
    }
  ]);
});

test("extracts next languages page start", () => {
  const raw = readFixture("languages-pagination-page-1-rsc.txt");

  assert.equal(extractNextLanguagesStart(raw), 10);
});

test("returns null when no next languages page exists", () => {
  const raw = readFixture("languages-pagination-page-2-rsc.txt");

  assert.equal(extractNextLanguagesStart(raw), null);
});

test("pagination response uses response-local RSC refs", () => {
  const page1 = parseLanguages(readFixture("languages-pagination-page-1-rsc.txt"));
  const page2 = parseLanguages(readFixture("languages-pagination-page-2-rsc.txt"));

  assert.deepEqual(page1[0], {
    name: "English",
    proficiency: "Professional working proficiency"
  });
  assert.deepEqual(page2[0], {
    name: "Hindi",
    proficiency: "Native or bilingual proficiency"
  });
});

test("fetches language pages until pagination is absent", async (t) => {
  const originalFetch = global.fetch;
  const originalCookie = process.env.LINKEDIN_COOKIE;
  const originalCsrf = process.env.LINKEDIN_CSRF_TOKEN;
  const calls = [];

  process.env.LINKEDIN_COOKIE = "dummy-cookie";
  process.env.LINKEDIN_CSRF_TOKEN = "dummy-csrf";

  global.fetch = async (url, options) => {
    calls.push({
      url: String(url),
      body: options.body
    });

    if (String(url).includes("/details/languages/")) {
      return rscResponse(readFixture("languages-screen-rsc.txt"));
    }

    const body = JSON.parse(options.body);
    if (body.clientArguments.payload.start === 0) {
      return rscResponse(readFixture("languages-pagination-page-1-rsc.txt"));
    }

    return rscResponse(readFixture("languages-pagination-page-2-rsc.txt"));
  };

  t.after(() => {
    global.fetch = originalFetch;
    restoreEnv("LINKEDIN_COOKIE", originalCookie);
    restoreEnv("LINKEDIN_CSRF_TOKEN", originalCsrf);
  });

  const result = await getLanguages("example");

  assert.equal(calls.length, 3);
  assert.deepEqual(
    calls.map((call) => JSON.parse(call.body).clientArguments?.payload?.start).filter((start) => start !== undefined),
    [0, 10]
  );
  assert.deepEqual(result.entries, [
    {
      name: "English",
      proficiency: "Professional working proficiency"
    },
    {
      name: "Kannada",
      proficiency: null
    },
    {
      name: "Hindi",
      proficiency: "Native or bilingual proficiency"
    }
  ]);
});

function readFixture(fileName) {
  return readFileSync(join(__dirname, "fixtures", fileName), "utf8");
}

function rscResponse(body) {
  return new Response(body, {
    status: 200,
    headers: {
      "content-type": "text/x-component"
    }
  });
}

function restoreEnv(name, value) {
  if (value === undefined) {
    delete process.env[name];
    return;
  }

  process.env[name] = value;
}
