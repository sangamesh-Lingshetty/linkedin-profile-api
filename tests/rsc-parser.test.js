import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { parseExperience } from "../src/rsc-parser.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

test("extracts useful experience fields from a sanitized RSC-like fixture", () => {
  const raw = readFileSync(join(__dirname, "fixtures", "experience-rsc.txt"), "utf8");

  assert.deepEqual(parseExperience(raw), [
    {
      title: "Member Technical Staff -1",
      company: "Aquera",
      employmentType: "Full-time",
      dateRange: "Feb 2025 - Present",
      duration: "1 yr 7 mos",
      location: "Bengaluru, Karnataka, India",
      workMode: "On-site",
      description: null,
      skills: [
        "Microservices Architecture",
        "AWS Lambda",
        "Node.js",
        "API Development",
        "DevOps",
        "Team Leadership"
      ]
    },
    {
      title: "Software Engineer",
      company: "Acme Labs",
      employmentType: "Internship",
      dateRange: "Jun 2020 - Dec 2021",
      duration: "1 yr 7 mos",
      location: "Remote",
      workMode: "Remote",
      description: null,
      skills: ["PostgreSQL", "Queues"]
    }
  ]);
});

test("parses grouped company roles without shifting parent fields", () => {
  const raw = [
    '1:{"children":["Experience"]}',
    '2:["$","div",null,{"children":["$L3","$L4","$L5"]}]',
    '3:{"children":["Bosch Global Software Technologies"]}',
    '4:{"children":["Full-time · 1 mo"]}',
    '5:{"children":["Bengaluru, Karnataka, India · On-site"]}',
    '6:["$","div",null,{"children":["$L7","$L8"]}]',
    '7:{"children":["Senior Design Engineer"]}',
    '8:{"children":["Aug 2026 - Present · 1 mo"]}',
    '9:["$","div",null,{"children":["$La","$Lb"]}]',
    'a:{"children":["Senior Engineer"]}',
    'b:{"children":["Aug 2026 - Present · 1 mo"]}',
    'c:["$","div",null,{"children":["$Ld","$Le","$Lf"]}]',
    'd:{"children":["Macurex Sensors Pvt Ltd"]}',
    'e:{"children":["Full-time · 2 yrs"]}',
    'f:{"children":["On-site"]}',
    '10:["$","div",null,{"children":["$L11","$L12","$L13"]}]',
    '11:{"children":["Research And Development Engineer"]}',
    '12:{"children":["May 2023 - Apr 2025 · 2 yrs"]}',
    '13:{"children":["anchepalya kambipura mysore road Bangalore"]}',
    '14:{"children":["Design Engineer"]}',
    '15:{"children":["May 2023 - Apr 2025 · 2 yrs"]}'
  ].join("\n");

  assert.deepEqual(parseExperience(raw), [
    {
      title: "Senior Design Engineer",
      company: "Bosch Global Software Technologies",
      employmentType: "Full-time",
      dateRange: "Aug 2026 - Present",
      duration: "1 mo",
      location: "Bengaluru, Karnataka, India",
      workMode: "On-site",
      description: null,
      skills: []
    },
    {
      title: "Senior Engineer",
      company: "Bosch Global Software Technologies",
      employmentType: "Full-time",
      dateRange: "Aug 2026 - Present",
      duration: "1 mo",
      location: "Bengaluru, Karnataka, India",
      workMode: "On-site",
      description: null,
      skills: []
    },
    {
      title: "Research And Development Engineer",
      company: "Macurex Sensors Pvt Ltd",
      employmentType: "Full-time",
      dateRange: "May 2023 - Apr 2025",
      duration: "2 yrs",
      location: "anchepalya kambipura mysore road Bangalore",
      workMode: "On-site",
      description: null,
      skills: []
    },
    {
      title: "Design Engineer",
      company: "Macurex Sensors Pvt Ltd",
      employmentType: "Full-time",
      dateRange: "May 2023 - Apr 2025",
      duration: "2 yrs",
      location: null,
      workMode: "On-site",
      description: null,
      skills: []
    }
  ]);
});

test("does not use location, employment type, or duration as experience fields", () => {
  const raw = [
    '1:{"children":["Experience"]}',
    '2:{"children":["Design Engineer"]}',
    '3:{"children":["Bengaluru · On-site"]}',
    '4:{"children":["May 2023 - Apr 2025 · 2 yrs"]}',
    '5:{"children":["Full-time"]}',
    '6:{"children":["2 yrs"]}',
    '7:{"children":["Jun 2020 - Dec 2021 · 1 yr 7 mos"]}'
  ].join("\n");

  assert.deepEqual(parseExperience(raw), [
    {
      title: "Design Engineer",
      company: null,
      employmentType: null,
      dateRange: "May 2023 - Apr 2025",
      duration: "2 yrs",
      location: null,
      workMode: null,
      description: null,
      skills: []
    }
  ]);
});
