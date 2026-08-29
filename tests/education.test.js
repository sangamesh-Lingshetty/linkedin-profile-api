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

function readFixture(fileName) {
  return readFileSync(join(__dirname, "fixtures", fileName), "utf8");
}
