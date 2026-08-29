import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { getCertifications } from "../src/certifications.js";
import {
  extractCertificationsProfileId,
  extractNextCertificationsStart,
  parseCertifications
} from "../src/rsc-parser.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

test("extracts certifications profileId", () => {
  const raw = readFixture("certifications-screen-rsc.txt");

  assert.equal(extractCertificationsProfileId(raw), "ACoAAACertExample123");
});

test("parses certification fields and full media URLs", () => {
  const raw = readFixture("certifications-pagination-page-1-rsc.txt");
  const certifications = parseCertifications(raw);

  assert.deepEqual(certifications[0], {
    id: "1456621303",
    name: "Special Appreciation",
    issuingOrganization: "Aquera",
    issueDate: "Sep 2025",
    expirationDate: null,
    credentialId: null,
    credentialUrl: null,
    issuerLogo:
      "https://media.licdn.com/dms/image/v2/D560BAQIssuer/company-logo_400_400/company-logo_400_400/0/aquera_logo?e=1&t=large",
    media: [
      {
        name: "20251012_103828.jpg",
        url:
          "https://media.licdn.com/dms/image/v2/D4DCertMedia/certification-media_1280_720/certification-media_1280_720/0/certificate?e=1&t=large"
      }
    ]
  });
  assert.notEqual(certifications[0].name, "Licenses & certifications");
  assert.notEqual(certifications[0].issuingOrganization, "Special Appreciation");
  assert.notEqual(certifications[0].credentialUrl, "https://www.linkedin.com/company/18114533/");
});

test("parses optional certification fields when present", () => {
  const raw = readFixture("certifications-pagination-page-1-rsc.txt");
  const certification = parseCertifications(raw)[1];

  assert.equal(certification.id, "222333444");
  assert.equal(certification.name, "Cloud Basics");
  assert.equal(certification.issuingOrganization, "Example Academy");
  assert.equal(certification.issueDate, "Jan 2024");
  assert.equal(certification.expirationDate, "Jan 2027");
  assert.equal(certification.credentialId, "ABC-123");
  assert.equal(certification.credentialUrl, "https://credentials.example.test/abc-123");
  assert.equal(certification.issuerLogo, null);
  assert.deepEqual(certification.media, []);
});

test("extracts next certifications page start", () => {
  const raw = readFixture("certifications-pagination-page-1-rsc.txt");

  assert.equal(extractNextCertificationsStart(raw), 10);
});

test("returns null when no next certifications page exists", () => {
  const raw = readFixture("certifications-pagination-page-2-rsc.txt");

  assert.equal(extractNextCertificationsStart(raw), null);
});

test("fetches certification pages and removes duplicate IDs", async (t) => {
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

    if (String(url).includes("/details/certifications/")) {
      return rscResponse(readFixture("certifications-screen-rsc.txt"));
    }

    const body = JSON.parse(options.body);
    if (body.clientArguments.payload.start === 0) {
      return rscResponse(readFixture("certifications-pagination-page-1-rsc.txt"));
    }

    return rscResponse(readFixture("certifications-pagination-page-2-rsc.txt"));
  };

  t.after(() => {
    global.fetch = originalFetch;
    restoreEnv("LINKEDIN_COOKIE", originalCookie);
    restoreEnv("LINKEDIN_CSRF_TOKEN", originalCsrf);
  });

  const result = await getCertifications("example");

  assert.equal(calls.length, 3);
  assert.deepEqual(
    calls.map((call) => JSON.parse(call.body).clientArguments?.payload?.start).filter((start) => start !== undefined),
    [0, 10]
  );
  assert.deepEqual(
    result.entries.map((certification) => certification.id),
    ["1456621303", "222333444", "998877665"]
  );
});

test("returns empty certifications when LinkedIn details screen is 404", async (t) => {
  const originalFetch = global.fetch;
  const originalCookie = process.env.LINKEDIN_COOKIE;
  const originalCsrf = process.env.LINKEDIN_CSRF_TOKEN;

  process.env.LINKEDIN_COOKIE = "dummy-cookie";
  process.env.LINKEDIN_CSRF_TOKEN = "dummy-csrf";

  global.fetch = async () =>
    new Response("Not found", {
      status: 404,
      headers: {
        "content-type": "text/plain"
      }
    });

  t.after(() => {
    global.fetch = originalFetch;
    restoreEnv("LINKEDIN_COOKIE", originalCookie);
    restoreEnv("LINKEDIN_CSRF_TOKEN", originalCsrf);
  });

  const result = await getCertifications("example");

  assert.deepEqual(result, {
    entries: [],
    linkedinStatus: 404,
    durationMs: 0
  });
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
