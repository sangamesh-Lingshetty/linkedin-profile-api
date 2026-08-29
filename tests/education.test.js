import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  extractEducationDetailsSectionRef,
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
    '2:{"renderPayload":{"rootUrl":"https://media.licdn.com/school-a_","imageRenditions":[{"width":100,"height":100,"suffixUrl":"small"},{"width":400,"height":400,"suffixUrl":"large"}]}}',
    '3:{"children":["Government Tool Room & Training Centre"]}',
    '4:{"children":["diploma in tool and die making, mechanical diploma"]}',
    '5:{"children":["Jun 2018 – Oct 2022"]}',
    '6:{"children":["Grade: 72.5%"]}',
    '7:{"children":["Activities and societies: CAD Design, Tool & Die Projects"]}',
    '8:{"renderPayload":{"rootUrl":"https://media.licdn.com/school-b_","imageRenditions":[{"width":100,"height":100,"suffixUrl":"small"}]}}',
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

function readFixture(fileName) {
  return readFileSync(join(__dirname, "fixtures", fileName), "utf8");
}
