import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { getSkills } from "../src/skills.js";
import {
  buildRscTextReferenceMap,
  extractNextSkillsStart,
  extractSkillsProfileId,
  parseSkills
} from "../src/rsc-parser.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

test("extracts skills profileId", () => {
  const raw = readFixture("skills-screen-rsc.txt");

  assert.equal(extractSkillsProfileId(raw), "ACoAAASkillsExample123");
});

test("extracts skill IDs and names", () => {
  const raw = readFixture("skills-pagination-page-1-rsc.txt");
  const skills = parseSkills(raw);

  assert.deepEqual(skills, [
    {
      id: "565475854",
      name: "Generative AI"
    },
    {
      id: "1760560923",
      name: "Node.js"
    },
    {
      id: "4",
      name: "Amazon Web Services (AWS)"
    },
    {
      id: "9900102030",
      name: "Continuous Integration and Continuous Delivery (CI/CD)"
    }
  ]);
});

test("resolves local RSC skill text references", () => {
  const raw = readFixture("skills-pagination-page-1-rsc.txt");

  assert.deepEqual(buildRscTextReferenceMap(raw), {
    "19": "Generative AI",
    "20": "Amazon Web Services (AWS)",
    "23": "Continuous Integration and Continuous Delivery (CI/CD)",
    "1d": "Node.js"
  });
});

test("supports refs with letters such as $L2a", () => {
  const raw = readFixture("skills-pagination-page-2-rsc.txt");

  assert.equal(buildRscTextReferenceMap(raw)["2a"], "Software Development");
});

test("does not return unresolved RSC refs as skill names", () => {
  const raw = readFixture("skills-pagination-page-1-rsc.txt");
  const skills = parseSkills(raw);

  assert.equal(skills.some((skill) => /^\$L/.test(skill.name)), false);
  assert.equal(skills.some((skill) => skill.id === "777777777"), false);
});

test("allows valid one-letter skill names", () => {
  const raw = [
    '1:{"componentKey":"com.linkedin.sdui.profile.skill(ACoAAAExample123, 21)","children":["$L2"]}',
    '2:{"children":["R"]}'
  ].join("\n");

  assert.deepEqual(parseSkills(raw), [
    {
      id: "21",
      name: "R"
    }
  ]);
});

test("RSC references are scoped independently per page", () => {
  const page1 = parseSkills(readFixture("skills-pagination-page-1-rsc.txt"));
  const page2 = parseSkills(readFixture("skills-pagination-page-2-rsc.txt"));

  assert.deepEqual(page1.find((skill) => skill.id === "565475854"), {
    id: "565475854",
    name: "Generative AI"
  });
  assert.deepEqual(page2.find((skill) => skill.id === "3300456001"), {
    id: "3300456001",
    name: "Systems Design"
  });
});

test("extracts next skills page start", () => {
  const raw = readFixture("skills-pagination-page-1-rsc.txt");

  assert.equal(extractNextSkillsStart(raw), 10);
});

test("returns null when no next skills page exists", () => {
  const raw = readFixture("skills-pagination-page-2-rsc.txt");

  assert.equal(extractNextSkillsStart(raw), null);
});

test("fetches skills pages until pagination is absent", async (t) => {
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

    if (String(url).includes("/details/skills/")) {
      return rscResponse(readFixture("skills-screen-rsc.txt"));
    }

    const body = JSON.parse(options.body);
    if (body.clientArguments.payload.start === 0) {
      return rscResponse(readFixture("skills-pagination-page-1-rsc.txt"));
    }

    return rscResponse(readFixture("skills-pagination-page-2-rsc.txt"));
  };

  t.after(() => {
    global.fetch = originalFetch;
    restoreEnv("LINKEDIN_COOKIE", originalCookie);
    restoreEnv("LINKEDIN_CSRF_TOKEN", originalCsrf);
  });

  const result = await getSkills("example");

  assert.equal(calls.length, 3);
  assert.deepEqual(
    calls.map((call) => JSON.parse(call.body).clientArguments?.payload?.start).filter((start) => start !== undefined),
    [0, 10]
  );
  assert.deepEqual(result.entries, [
    {
      id: "565475854",
      name: "Generative AI"
    },
    {
      id: "1760560923",
      name: "Node.js"
    },
    {
      id: "4",
      name: "Amazon Web Services (AWS)"
    },
    {
      id: "9900102030",
      name: "Continuous Integration and Continuous Delivery (CI/CD)"
    },
    {
      id: "3300456001",
      name: "Systems Design"
    },
    {
      id: "4400456002",
      name: "Microservices Architecture"
    },
    {
      id: "5500456003",
      name: "MongoDB"
    },
    {
      id: "6600456004",
      name: "PostgreSQL"
    }
  ]);
  assert.equal(result.entries.some((skill) => /^\$L/.test(skill.name)), false);
  assert.equal(result.entries.filter((skill) => skill.id === "1760560923").length, 1);
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
