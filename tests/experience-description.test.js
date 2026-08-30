import assert from "node:assert/strict";
import test from "node:test";
import { parseExperience } from "../src/rsc-parser.js";

test("parses simple experience description from expandable text block", () => {
  const result = parseExperience(singleExperienceFixture(
    descriptionBlock(9, ["Built backend APIs for customer integrations."])
  ));

  assert.equal(result[0].description, "Built backend APIs for customer integrations.");
  assert.deepEqual(result[0].skills, []);
});

test("does not treat role row with date as grouped company parent", () => {
  const raw = [
    '1:{"children":["Experience"]}',
    '2:["$","div",null,{"children":["$L3","$L4","$L5","$L6"]}]',
    '3:{"children":["Member Technical Staff -1"]}',
    '4:{"children":["Aquera \\u00b7 Full-time"]}',
    '5:{"children":["Feb 2025 - Present \\u00b7 1 yr 7 mos"]}',
    '6:{"children":["Bengaluru, Karnataka, India \\u00b7 On-site"]}',
    descriptionBlock(7, ["Built backend APIs."])
  ].join("\n");

  assert.deepEqual(parseExperience(raw), [
    {
      title: "Member Technical Staff -1",
      company: "Aquera",
      employmentType: "Full-time",
      dateRange: "Feb 2025 - Present",
      duration: "1 yr 7 mos",
      location: "Bengaluru, Karnataka, India",
      workMode: "On-site",
      description: "Built backend APIs.",
      skills: []
    }
  ]);
});

test("preserves multiline experience description and reasonable blank lines", () => {
  const result = parseExperience(singleExperienceFixture(
    descriptionBlock(9, [
      "Backend Engineer - Aquera",
      "Feb 2025 - Present | Bengaluru, India",
      "Built backend APIs and enterprise integrations.",
      "",
      "Worked on integrations with Entra ID and Okta.",
      "",
      "Debugged production issues."
    ])
  ));

  assert.equal(
    result[0].description,
    [
      "Backend Engineer - Aquera",
      "Feb 2025 - Present | Bengaluru, India",
      "Built backend APIs and enterprise integrations.",
      "",
      "Worked on integrations with Entra ID and Okta.",
      "",
      "Debugged production issues."
    ].join("\n")
  );
});

test("keeps Skills line inside description without using it as experience skills", () => {
  const result = parseExperience(singleExperienceFixture(
    descriptionBlock(9, [
      "Built scalable backend logic.",
      "Skills: Microservices Architecture • AWS Lambda • Node.js"
    ])
  ));

  assert.equal(
    result[0].description,
    "Built scalable backend logic.\nSkills: Microservices Architecture • AWS Lambda • Node.js"
  );
  assert.deepEqual(result[0].skills, []);
});

test("experience without expandable description returns null", () => {
  const result = parseExperience(singleExperienceFixture(""));

  assert.equal(result[0].description, null);
});

test("two experience records do not leak descriptions", () => {
  const result = parseExperience([
    singleExperienceFixture(descriptionBlock(9, ["Description A"])),
    '20:{"children":["Software Engineer"]}',
    '21:{"children":["Acme Labs \\u00b7 Internship"]}',
    '22:{"children":["Jun 2020 - Dec 2021 \\u00b7 1 yr 7 mos"]}',
    '23:{"children":["Remote"]}',
    descriptionBlock(24, ["Description B"])
  ].join("\n"));

  assert.deepEqual(result.map((entry) => entry.description), [
    "Description A",
    "Description B"
  ]);
});

test("grouped company child roles keep their own descriptions", () => {
  const raw = [
    '1:{"children":["Experience"]}',
    '2:["$","div",null,{"children":["$L3","$L4","$L5"]}]',
    '3:{"children":["Bosch Global Software Technologies"]}',
    '4:{"children":["Full-time \\u00b7 1 mo"]}',
    '5:{"children":["Bengaluru, Karnataka, India \\u00b7 On-site"]}',
    '6:["$","div",null,{"children":["$L7","$L8"]}]',
    '7:{"children":["Senior Design Engineer"]}',
    '8:{"children":["Aug 2026 - Present \\u00b7 1 mo"]}',
    descriptionBlock(9, ["Description A"]),
    '10:["$","div",null,{"children":["$L11","$L12"]}]',
    '11:{"children":["Senior Engineer"]}',
    '12:{"children":["Aug 2026 - Present \\u00b7 1 mo"]}',
    descriptionBlock(13, ["Description B"])
  ].join("\n");

  const result = parseExperience(raw);

  assert.deepEqual(result.map((entry) => ({
    title: entry.title,
    company: entry.company,
    description: entry.description
  })), [
    {
      title: "Senior Design Engineer",
      company: "Bosch Global Software Technologies",
      description: "Description A"
    },
    {
      title: "Senior Engineer",
      company: "Bosch Global Software Technologies",
      description: "Description B"
    }
  ]);
});

test("parses company coordinator role and standalone company names containing India", () => {
  const raw = [
    '1:{"children":["Experience"]}',
    '2:{"children":["Software Engineer"]}',
    '3:{"children":["Intel \\u00b7 Full-time"]}',
    '4:{"children":["Jul 2023 - Jan 2025 \\u00b7 1 yr 7 mos"]}',
    '5:{"children":["Bangalore Urban, Karnataka, India \\u00b7 Hybrid"]}',
    '6:{"children":["Company Coordinator"]}',
    '7:{"children":["Placement Office, IIT Bombay \\u00b7 Full-time"]}',
    '8:{"children":["Jun 2022 - Jul 2023 \\u00b7 1 yr 2 mos"]}',
    '9:{"children":["Mumbai, Maharashtra, India"]}',
    '10:{"children":["Software Engineer"]}',
    '11:{"children":["TEKsystems Global Services in India"]}',
    '12:{"children":["Aug 2019 - Jul 2021 \\u00b7 2 yrs"]}',
    '13:{"children":["Worked as a Big Data Engineer in the Data Analysis and Insights department on multiple projects."]}'
  ].join("\n");

  assert.deepEqual(parseExperience(raw), [
    {
      title: "Software Engineer",
      company: "Intel",
      employmentType: "Full-time",
      dateRange: "Jul 2023 - Jan 2025",
      duration: "1 yr 7 mos",
      location: "Bangalore Urban, Karnataka, India",
      workMode: "Hybrid",
      description: null,
      skills: []
    },
    {
      title: "Company Coordinator",
      company: "Placement Office, IIT Bombay",
      employmentType: "Full-time",
      dateRange: "Jun 2022 - Jul 2023",
      duration: "1 yr 2 mos",
      location: "Mumbai, Maharashtra, India",
      workMode: null,
      description: null,
      skills: []
    },
    {
      title: "Software Engineer",
      company: "TEKsystems Global Services in India",
      employmentType: null,
      dateRange: "Aug 2019 - Jul 2021",
      duration: "2 yrs",
      location: null,
      workMode: null,
      description: null,
      skills: []
    }
  ]);
});

test("never treats bullet description text as an experience location", () => {
  const raw = [
    '1:{"children":["Experience"]}',
    '2:{"children":["Software Engineer"]}',
    '3:{"children":["TEKsystems Global Services in India"]}',
    '4:{"children":["Aug 2019 - Jul 2021 \\u00b7 2 yrs"]}',
    '5:{"children":["• Automated insurance claim processing for US healthcare, reducing manual workflows."]}',
    '6:{"children":["Associate Data Engineer"]}',
    '7:{"children":["Celebal Technologies \\u00b7 Internship"]}',
    '8:{"children":["May 2018 - Oct 2018 \\u00b7 6 mos"]}',
    '9:{"children":["Greater Jaipur Area"]}'
  ].join("\n");

  const result = parseExperience(raw);

  assert.equal(result[0].location, null);
  assert.equal(result[0].description, null);
  assert.equal(result[1].location, "Greater Jaipur Area");
  assert.equal(result[1].description, null);
});

test("keeps child-specific location when it has address-style sector text", () => {
  const raw = [
    '1:{"children":["Experience"]}',
    '2:["$","div",null,{"children":["$L3","$L4","$L5"]}]',
    '3:{"children":["Appinventiv"]}',
    '4:{"children":["Full-time \\u00b7 4 yrs"]}',
    '5:{"children":["Noida, Uttar Pradesh, India"]}',
    '6:{"children":["Software Engineer"]}',
    '7:{"children":["Sep 2022 - Present \\u00b7 4 yrs"]}',
    '8:{"children":["Noida, Uttar Pradesh, India"]}',
    '9:{"children":["Software Trainee"]}',
    '10:{"children":["Feb 2022 - Sep 2022 \\u00b7 8 mos"]}',
    '11:{"children":["Noida sector 58 B-25"]}'
  ].join("\n");

  assert.deepEqual(parseExperience(raw).map((entry) => ({
    title: entry.title,
    location: entry.location
  })), [
    {
      title: "Software Engineer",
      location: "Noida, Uttar Pradesh, India"
    },
    {
      title: "Software Trainee",
      location: "Noida sector 58 B-25"
    }
  ]);
});

function singleExperienceFixture(extra) {
  return [
    '0:{"children":["advertisement"]}',
    '1:{"children":["Experience"]}',
    '2:{"children":["Member Technical Staff -1"]}',
    '3:{"children":["Aquera \\u00b7 Full-time"]}',
    '4:{"children":["Feb 2025 - Present \\u00b7 1 yr 7 mos"]}',
    '5:{"children":["Bengaluru, Karnataka, India \\u00b7 On-site"]}',
    extra
  ].filter(Boolean).join("\n");
}

function descriptionBlock(id, lines) {
  const children = lines.map((line, index) => {
    const prefix = index === 0 ? "null" : '["$","br",null,{}]';
    return `["$","$1","${index}",{"children":[${prefix},"${escapeJson(line)}"]}]`;
  }).join(",");

  return `${id}:["$","$Lda",null,{"textProps":{"children":[[${children}]],"shouldCollapseNewLines":false},"bindingKey":"expandable_text_block_auto-component-example"}]`;
}

function escapeJson(value) {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}
