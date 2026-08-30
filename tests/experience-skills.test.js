import assert from "node:assert/strict";
import test from "node:test";
import { getExperience } from "../src/experience.js";

test("experience with no skill association keeps empty skills", async (t) => {
  mockLinkedIn(t, async (url) => {
    assert.equal(String(url).includes("ProfileSkillAssociationDetailsScreen"), false);
    return rscResponse(experienceFixture(""));
  });

  const result = await getExperience("example");

  assert.deepEqual(result.entries[0].skills, []);
});

test("experience skill association request attaches hidden skills to matching role", async (t) => {
  const calls = [];
  mockLinkedIn(t, async (url, options) => {
    calls.push({
      url: String(url),
      body: JSON.parse(options.body)
    });

    if (String(url).includes("ProfileSkillAssociationDetailsScreen")) {
      return rscResponse([
        skillAssociationFixture([
          "Node.js",
          "Amazon Web Services (AWS)",
          "Express.js",
          "PostgreSQL",
          "JavaScript"
        ]),
        '99:{"children":["Member Technical Staff -1 at Aquera"]}'
      ].join("\n"));
    }

    return rscResponse(experienceFixture(
      associationPayload("2593285733", "Member Technical Staff -1 at Aquera")
    ));
  });

  const result = await getExperience("example");
  const associationCall = calls.find((call) => call.url.includes("ProfileSkillAssociationDetailsScreen"));

  assert.deepEqual(result.entries[0].skills, [
    "Node.js",
    "Amazon Web Services (AWS)",
    "Express.js",
    "PostgreSQL",
    "JavaScript"
  ]);
  assert.equal(associationCall.body.clientArguments.payload.associationId, "2593285733");
  assert.equal(
    associationCall.body.clientArguments.payload.associationTitle,
    "Member Technical Staff -1 at Aquera"
  );
});

test("association request failure preserves experience with empty skills", async (t) => {
  mockLinkedIn(t, async (url) => {
    if (String(url).includes("ProfileSkillAssociationDetailsScreen")) {
      return new Response("Not found", { status: 404 });
    }

    return rscResponse(experienceFixture(
      associationPayload("2593285733", "Member Technical Staff -1 at Aquera")
    ));
  });

  const result = await getExperience("example");

  assert.deepEqual(result.entries[0].skills, []);
});

test("associationId remains tied to the correct experience record", async (t) => {
  mockLinkedIn(t, async (url, options) => {
    if (String(url).includes("ProfileSkillAssociationDetailsScreen")) {
      const body = JSON.parse(options.body);
      return rscResponse(skillAssociationFixture(
        body.clientArguments.payload.associationId === "first"
          ? ["Node.js"]
          : ["PostgreSQL"]
      ));
    }

    return rscResponse(twoExperienceFixture([
      associationPayload("first", "Member Technical Staff -1 at Aquera", 30),
      associationPayload("second", "Software Engineer at Acme Labs", 31)
    ].join("\n")));
  });

  const result = await getExperience("example");

  assert.deepEqual(result.entries.map((entry) => entry.skills), [
    ["Node.js"],
    ["PostgreSQL"]
  ]);
});

function experienceFixture(extra) {
  return [
    '0:{"children":["advertisement"]}',
    '1:{"children":["ToastDuration_UNKNOWN"]}',
    '2:{"children":["topStart"]}',
    '3:{"children":["Bengaluru / Remote India"]}',
    '4:{"children":["Experience"]}',
    '5:{"children":["Member Technical Staff -1"]}',
    '6:{"children":["Aquera \\u00b7 Full-time"]}',
    '7:{"children":["Feb 2025 - Present \\u00b7 1 yr 7 mos"]}',
    '8:{"children":["Bengaluru, Karnataka, India \\u00b7 On-site"]}',
    extra
  ].filter(Boolean).join("\n");
}

function twoExperienceFixture(extra) {
  return [
    experienceFixture(""),
    '20:{"children":["Software Engineer"]}',
    '21:{"children":["Acme Labs \\u00b7 Internship"]}',
    '22:{"children":["Jun 2020 - Dec 2021 \\u00b7 1 yr 7 mos"]}',
    '23:{"children":["Remote"]}',
    extra
  ].filter(Boolean).join("\n");
}

function associationPayload(associationId, associationTitle, recordId = 9) {
  return `${recordId}:{"payload":{"vanityName":"example","associationType":"position","associationId":"${associationId}","associationTitle":"${associationTitle}","isVanityNameResolved":true},"requestMetadata":{"$type":"proto.sdui.common.RequestMetadata"}}`;
}

function skillAssociationFixture(skills) {
  return skills.map((skill, index) =>
    `${index + 1}:{"componentKey":"com.linkedin.sdui.profile.skill(ACoAAAExample123, ${index + 1})","aria-label":"Collapsed, ${skill}","children":["${skill}"]}`
  ).join("\n");
}

function mockLinkedIn(t, handler) {
  const originalFetch = global.fetch;
  const originalCookie = process.env.LINKEDIN_COOKIE;
  const originalCsrf = process.env.LINKEDIN_CSRF_TOKEN;

  process.env.LINKEDIN_COOKIE = "dummy-cookie";
  process.env.LINKEDIN_CSRF_TOKEN = "dummy-csrf";
  global.fetch = handler;

  t.after(() => {
    global.fetch = originalFetch;
    restoreEnv("LINKEDIN_COOKIE", originalCookie);
    restoreEnv("LINKEDIN_CSRF_TOKEN", originalCsrf);
  });
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
