import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { getEducation } from "../src/education.js";
import {
  extractEducationDetailsSectionRef,
  extractNextEducationStart,
  extractEducationPaginationInfo,
  extractEducationProfileId,
  parseEducation
} from "../src/rsc-parser.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

test("extracts education profileId", () => {
  const raw = readFixture("education-screen-rsc.txt");

  assert.equal(extractEducationProfileId(raw), "ACoAAAExample123");
});

test("extracts EducationDetailsSection ref", () => {
  const raw = readFixture("education-screen-rsc.txt");

  assert.equal(
    extractEducationDetailsSectionRef(raw),
    "urn:li:fsd_profile:ACoAAAExample123,EducationDetailsSection"
  );
});

test("extracts education pagination contract", () => {
  const raw = readFixture("education-screen-rsc.txt");

  assert.deepEqual(extractEducationPaginationInfo(raw), {
    profileId: "ACoAAAExample123",
    detailSectionReplaceableComponentRef:
      "urn:li:fsd_profile:ACoAAAExample123,EducationDetailsSection"
  });
});

test("parses education record", () => {
  const raw = readFixture("education-pagination-rsc.txt");
  const education = parseEducation(raw);

  assert.equal(education.length, 1);
  assert.deepEqual(education[0], {
    school: "Dayananda Sagar University",
    degree: "Bachelor of Engineering - BE",
    fieldOfStudy: "Computer Science",
    dateRange: "Nov 2022 \u2013 Jun 2025",
    grade: "Bachelor of Technology - Computer Science & Engineering",
    activities: [
      "Special Recognition Award (2025)",
      "Hackathon Winner (College-level)",
      "Problem Solving: 100+ LeetCode problems solved"
    ],
    description:
      "Relevant Coursework: Data Structures & Algorithms \u2022 Database Management Systems \u2022 Operating Systems \u2022 Computer Networks \u2022 Cloud Computing \u2022 Software Engineering",
    schoolLogo:
      "https://media.licdn.com/dms/image/v2/D560BAQErICFizHTwhw/company-logo_400_400/company-logo_400_400/0/example_logo?e=1&v=beta&t=large"
  });
});

test("parses education grade, activities, description, and complete school logo", () => {
  const raw = readFixture("education-pagination-rsc.txt");
  const [education] = parseEducation(raw);

  assert.equal(education.grade, "Bachelor of Technology - Computer Science & Engineering");
  assert.deepEqual(education.activities, [
    "Special Recognition Award (2025)",
    "Hackathon Winner (College-level)",
    "Problem Solving: 100+ LeetCode problems solved"
  ]);
  assert.equal(
    education.description,
    "Relevant Coursework: Data Structures & Algorithms \u2022 Database Management Systems \u2022 Operating Systems \u2022 Computer Networks \u2022 Cloud Computing \u2022 Software Engineering"
  );
  assert.equal(
    education.schoolLogo,
    "https://media.licdn.com/dms/image/v2/D560BAQErICFizHTwhw/company-logo_400_400/company-logo_400_400/0/example_logo?e=1&v=beta&t=large"
  );
});

test("keeps education fields associated with their own school", () => {
  const raw = [
    '1:{"children":["Education"]}',
    '2:{"children":["Government Tool Room & Training Centre logo"],"renderPayload":{"rootUrl":"https://media.licdn.com/school-a_","imageRenditions":[{"width":100,"height":100,"suffixUrl":"small"},{"width":400,"height":400,"suffixUrl":"large"}]}}',
    '3:{"children":["Government Tool Room & Training Centre"]}',
    '4:{"children":["diploma in tool and die making, mechanical diploma"]}',
    '5:{"children":["Jun 2018 – Oct 2022"]}',
    '6:{"children":["Grade: 72.5%"]}',
    '7:{"children":["Activities and societies: CAD Design, Tool & Die Projects"]}',
    '8:{"children":["Panchashila High School Bidar logo"],"renderPayload":{"rootUrl":"https://media.licdn.com/school-b_","imageRenditions":[{"width":100,"height":100,"suffixUrl":"small"}]}}',
    '9:{"children":["Panchashila High School Bidar"]}',
    'a:{"children":["Govt Tool Room and Training Centre Bidar, Mechanical Engineering"]}',
    'b:{"children":["Jul 2018 – Oct 2022"]}',
    'c:{"children":["Activities and societies: 3d Printing New Research design, Graphic design Character"]}'
  ].join("\n");

  assert.deepEqual(parseEducation(raw), [
    {
      school: "Government Tool Room & Training Centre",
      degree: "diploma in tool and die making",
      fieldOfStudy: "mechanical diploma",
      dateRange: "Jun 2018 – Oct 2022",
      grade: "72.5%",
      activities: ["CAD Design, Tool & Die Projects"],
      description: null,
      schoolLogo: "https://media.licdn.com/school-a_large"
    },
    {
      school: "Panchashila High School Bidar",
      degree: "Govt Tool Room and Training Centre Bidar",
      fieldOfStudy: "Mechanical Engineering",
      dateRange: "Jul 2018 – Oct 2022",
      grade: null,
      activities: ["3d Printing New Research design, Graphic design Character"],
      description: null,
      schoolLogo: "https://media.licdn.com/school-b_small"
    }
  ]);
});

test("does not mix education references across independent responses", () => {
  const first = [
    '1:{"children":["Education"]}',
    '2:{"children":["School One"]}',
    '3:{"children":["Degree One, Field One"]}',
    '4:{"children":["Jan 2020 – Jan 2021"]}',
    '5:{"children":["Grade: A"]}'
  ].join("\n");
  const second = [
    '1:{"children":["Education"]}',
    '2:{"children":["School Two"]}',
    '3:{"children":["Degree Two, Field Two"]}',
    '4:{"children":["Jan 2022 – Jan 2023"]}'
  ].join("\n");

  assert.equal(parseEducation(first)[0].grade, "A");
  assert.equal(parseEducation(second)[0].grade, null);
});

test("does not propagate unlabeled education logos to neighboring schools", () => {
  const raw = [
    '1:{"children":["Education"]}',
    '2:{"children":["School One logo"],"renderPayload":{"rootUrl":"https://media.licdn.com/school-one_","imageRenditions":[{"width":400,"height":400,"suffixUrl":"large"}]}}',
    '4:{"children":["School One"]}',
    '5:{"children":["Degree One"]}',
    '6:{"children":["Jan 2020 â€“ Jan 2021"]}',
    '7:{"renderPayload":{"rootUrl":"https://media.licdn.com/unlabeled_","imageRenditions":[{"width":400,"height":400,"suffixUrl":"large"}]}}',
    '8:{"children":["School Two"]}',
    '9:{"children":["Degree Two"]}',
    'a:{"children":["Jan 2022 â€“ Jan 2023"]}'
  ].join("\n");

  assert.deepEqual(parseEducation(raw).map((entry) => [entry.school, entry.schoolLogo]), [
    ["School One", "https://media.licdn.com/school-one_large"],
    ["School Two", null]
  ]);
});

test("does not use a nearby logo from another education row", () => {
  const raw = [
    '1:{"children":["Education"]}',
    '2:{"children":["DIT UNIVERSITY logo"],"renderPayload":{"rootUrl":"https://media.licdn.com/dit_","imageRenditions":[{"width":400,"height":400,"suffixUrl":"large"}]}}',
    '3:{"children":["DIT UNIVERSITY"]}',
    '4:{"children":["Bachelor of Technology"]}',
    '5:{"children":["2018 \\u2013 2022"]}',
    '6:{"renderPayload":{"rootUrl":"https://media.licdn.com/global-nearby_","imageRenditions":[{"width":400,"height":400,"suffixUrl":"large"}]}}',
    '7:{"children":["Pinewood School"]}',
    '8:{"children":["2016 \\u2013 2018"]}',
    '9:{"children":["Infant Jesus School"]}',
    'a:{"children":["2014 \\u2013 2016"]}'
  ].join("\n");

  assert.deepEqual(parseEducation(raw).map((entry) => [entry.school, entry.schoolLogo]), [
    ["DIT UNIVERSITY", "https://media.licdn.com/dit_large"],
    ["Pinewood School", null],
    ["Infant Jesus School", null]
  ]);
});

test("three education rows only first receives its owned logo", () => {
  const raw = [
    '1:{"children":["Education"]}',
    '2:{"children":["First University logo"],"renderPayload":{"rootUrl":"https://media.licdn.com/first_","imageRenditions":[{"width":400,"height":400,"suffixUrl":"large"}]}}',
    '3:{"children":["First University"]}',
    '4:{"children":["Degree One"]}',
    '5:{"children":["2015 \\u2013 2019"]}',
    '6:{"children":["Second College"]}',
    '7:{"children":["Degree Two"]}',
    '8:{"children":["2013 \\u2013 2015"]}',
    '9:{"children":["Third School"]}',
    'a:{"children":["2011 \\u2013 2013"]}'
  ].join("\n");

  assert.deepEqual(parseEducation(raw).map((entry) => [entry.school, entry.schoolLogo]), [
    ["First University", "https://media.licdn.com/first_large"],
    ["Second College", null],
    ["Third School", null]
  ]);
});

test("rejects CSS-like garbage as education degree", () => {
  const raw = [
    '1:{"children":["Education"]}',
    '2:{"children":["Holy Cross, Salem"]}',
    '3:{"children":["ac0c88fb _52b1324c _4af85412 f4de4f5a b3b6a3b6"]}',
    '4:{"children":["1997 â€“ 2004"]}'
  ].join("\n");

  assert.deepEqual(parseEducation(raw), [
    {
      school: "Holy Cross, Salem",
      degree: null,
      fieldOfStudy: null,
      dateRange: "1997 â€“ 2004",
      grade: null,
      activities: [],
      description: null,
      schoolLogo: null
    }
  ]);
});

test("keeps education rows with only a school name", () => {
  const raw = [
    '1:{"children":["Education"]}',
    '2:{"children":["Fergusson College, Pune"]}',
    '3:{"children":["HSC"]}',
    '4:{"children":["Jun 2019 \\u2013 May 2021"]}',
    '5:{"children":["Example High School"]}'
  ].join("\n");

  assert.deepEqual(parseEducation(raw), [
    {
      school: "Fergusson College, Pune",
      degree: "HSC",
      fieldOfStudy: null,
      dateRange: "Jun 2019 \u2013 May 2021",
      grade: null,
      activities: [],
      description: null,
      schoolLogo: null
    },
    {
      school: "Example High School",
      degree: null,
      fieldOfStudy: null,
      dateRange: null,
      grade: null,
      activities: [],
      description: null,
      schoolLogo: null
    }
  ]);
});

test("extracts next education page start", () => {
  const raw = [
    '1:{"pagerId":"com.linkedin.sdui.pagers.profile.details.education"}',
    '2:{"payload":{"start":10,"count":10}}'
  ].join("\n");

  assert.equal(extractNextEducationStart(raw), 10);
});

test("fetches education pages until pagination is absent", async (t) => {
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

    if (String(url).includes("/details/education/")) {
      return rscResponse(readFixture("education-screen-rsc.txt"));
    }

    const body = JSON.parse(options.body);
    if (body.clientArguments.payload.start === 0) {
      return rscResponse([
        '1:{"children":["Education"]}',
        '2:{"children":["School One"]}',
        '3:{"children":["Degree One"]}',
        '4:{"children":["Jan 2020 â€“ Jan 2021"]}',
        '5:{"pagerId":"com.linkedin.sdui.pagers.profile.details.education","payload":{"start":10,"count":10}}'
      ].join("\n"));
    }

    return rscResponse([
      '1:{"children":["Education"]}',
      '2:{"children":["School Two"]}',
      '3:{"children":["Degree Two"]}',
      '4:{"children":["Jan 2022 â€“ Jan 2023"]}'
    ].join("\n"));
  };

  t.after(() => {
    global.fetch = originalFetch;
    restoreEnv("LINKEDIN_COOKIE", originalCookie);
    restoreEnv("LINKEDIN_CSRF_TOKEN", originalCsrf);
  });

  const result = await getEducation("example");

  assert.deepEqual(
    calls.map((call) => JSON.parse(call.body).clientArguments?.payload?.start).filter((start) => start !== undefined),
    [0, 10]
  );
  assert.deepEqual(result.entries.map((entry) => entry.school), ["School One", "School Two"]);
});

function readFixture(fileName) {
  return readFileSync(join(__dirname, "fixtures", fileName), "utf8");
}

function rscResponse(body) {
  return new Response(body, {
    status: 200,
    headers: {
      "content-type": "application/octet-stream"
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
