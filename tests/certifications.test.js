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

test("parses public certification rows when ids are absent", () => {
  const raw = [
    '1:{"children":["Licenses & certifications"]}',
    '2:{"viewName":"license-certifications-lockup-view","children":["SnowPro Core Certification"]}',
    '3:{"children":["Snowflake"]}',
    '4:{"children":["Issued Nov 2020 \\u00b7 Expired Dec 2022"]}',
    '5:{"viewName":"license-certifications-lockup-view","children":["Data Science with Python"]}',
    '6:{"children":["Simplilearn"]}',
    '7:{"children":["Issued Apr 2018"]}',
    '8:{"children":["Credential ID 737778"]}'
  ].join("\n");

  assert.deepEqual(parseCertifications(raw), [
    {
      id: null,
      name: "SnowPro Core Certification",
      issuingOrganization: "Snowflake",
      issueDate: "Nov 2020",
      expirationDate: "Dec 2022",
      credentialId: null,
      credentialUrl: null,
      issuerLogo: null,
      media: []
    },
    {
      id: null,
      name: "Data Science with Python",
      issuingOrganization: "Simplilearn",
      issueDate: "Apr 2018",
      expirationDate: null,
      credentialId: "737778",
      credentialUrl: null,
      issuerLogo: null,
      media: []
    }
  ]);
});

test("parses public certification rows without issue dates", () => {
  const raw = [
    '1:{"children":["Licenses & certifications"]}',
    '2:{"viewName":"license-certifications-lockup-view","children":["Analyzing and Visualizing Data with Microsoft Power BI"]}',
    '3:{"children":["LinkedIn Learning"]}',
    '4:{"children":["Analyzing and Visualizing Data with Microsoft Power BI"]}',
    '5:{"children":["LinkedIn Learning ⋅ Course Certificate"]}',
    '6:{"viewName":"license-certifications-lockup-view","children":["R Studio"]}',
    '7:{"children":["ExcelR"]}',
    '8:{"children":["Issued Aug 2017"]}'
  ].join("\n");

  assert.deepEqual(parseCertifications(raw).map((certification) => ({
    name: certification.name,
    issuingOrganization: certification.issuingOrganization,
    issueDate: certification.issueDate
  })), [
    {
      name: "Analyzing and Visualizing Data with Microsoft Power BI",
      issuingOrganization: "LinkedIn Learning",
      issueDate: null
    },
    {
      name: "R Studio",
      issuingOrganization: "ExcelR",
      issueDate: "Aug 2017"
    }
  ]);
});

test("merges public certification rows that do not have lockup anchors", () => {
  const raw = [
    '1:{"children":["Licenses & certifications"]}',
    '2:{"viewName":"license-certifications-lockup-view","children":["Google Analytics"]}',
    '3:{"children":["Google"]}',
    '4:{"children":["Issued Oct 2017"]}',
    '5:{"children":["Google AdWords"]}',
    '6:{"children":["Google"]}'
  ].join("\n");

  assert.deepEqual(parseCertifications(raw).map((certification) => ({
    name: certification.name,
    issuingOrganization: certification.issuingOrganization,
    issueDate: certification.issueDate
  })), [
    {
      name: "Google Analytics",
      issuingOrganization: "Google",
      issueDate: "Oct 2017"
    },
    {
      name: "Google AdWords",
      issuingOrganization: "Google",
      issueDate: null
    }
  ]);
});

test("does not duplicate certification rows from course certificate metadata", () => {
  const raw = [
    '1:{"children":["Licenses & certifications"]}',
    '2:{"viewName":"license-certifications-lockup-view","children":["Analyzing and Visualizing Data with Microsoft Power BI"]}',
    '3:{"children":["LinkedIn Learning"]}',
    '4:{"children":["Analyzing and Visualizing Data with Microsoft Power BI"]}',
    '5:{"children":["LinkedIn Learning â‹… Course Certificate"]}'
  ].join("\n");

  assert.equal(parseCertifications(raw).length, 1);
});

test("rejects malformed public certification rows", () => {
  const raw = [
    '1:{"children":["Licenses & certifications"]}',
    '2:{"viewName":"license-certifications-lockup-view","children":[",null,{"]}',
    '3:{"children":[",null,{"]}',
    '4:{"viewName":"license-certifications-lockup-view","children":["Real Certification"]}',
    '5:{"children":["Real Issuer"]}'
  ].join("\n");

  assert.deepEqual(parseCertifications(raw).map((certification) => ({
    name: certification.name,
    issuingOrganization: certification.issuingOrganization
  })), [
    {
      name: "Real Certification",
      issuingOrganization: "Real Issuer"
    }
  ]);
});

test("does not leak certification metadata across public rows", () => {
  const raw = [
    '1:{"children":["Licenses & certifications"]}',
    '2:{"viewName":"license-certifications-lockup-view","children":["Certification One"]}',
    '3:{"children":["Issuer One"]}',
    '4:{"children":["Issued Jan 2024"]}',
    '5:{"children":["Credential ID ABC"]}',
    '6:{"url":"https://credentials.example.test/abc"}',
    '7:{"renderPayload":{"rootUrl":"https://media.licdn.com/company-logo_","imageRenditions":[{"width":400,"height":400,"suffixUrl":"large"}]}}',
    '8:{"viewName":"license-certifications-lockup-view","children":["Certification Two"]}',
    '9:{"children":["Issuer Two"]}',
    'a:{"children":["Issued Feb 2024"]}'
  ].join("\n");

  const [first, second] = parseCertifications(raw);

  assert.equal(first.credentialId, "ABC");
  assert.equal(first.credentialUrl, "https://credentials.example.test/abc");
  assert.equal(first.issuerLogo, "https://media.licdn.com/company-logo_large");
  assert.equal(second.credentialId, null);
  assert.equal(second.credentialUrl, null);
  assert.equal(second.issuerLogo, null);
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
