import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  extractExperienceSkillAssociations,
  parseExperience,
  parseExperienceSkillAssociationDetails
} from "../src/rsc-parser.js";

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

test("parses company names containing India and grouped children", () => {
  const raw = [
    '1:{"children":["Experience"]}',
    '2:{"children":["Senior Manager - Demand Planning"]}',
    '3:{"children":["Lowe\\u0027s India \\u00b7 Full-time"]}',
    '4:{"children":["May 2022 - Present \\u00b7 4 yrs 4 mos"]}',
    '5:{"children":["Bengaluru, Karnataka, India \\u00b7 Hybrid"]}',
    '6:{"children":["AB InBev India"]}',
    '7:{"children":["Full-time \\u00b7 3 yrs 5 mos"]}',
    '8:{"children":["Bengaluru, Karnataka, India"]}',
    '9:{"children":["Demand Planning Manager"]}',
    'a:{"children":["Jul 2020 - May 2022 \\u00b7 1 yr 11 mos"]}'
  ].join("\n");

  assert.deepEqual(parseExperience(raw).slice(0, 2), [
    {
      title: "Senior Manager - Demand Planning",
      company: "Lowe's India",
      employmentType: "Full-time",
      dateRange: "May 2022 - Present",
      duration: "4 yrs 4 mos",
      location: "Bengaluru, Karnataka, India",
      workMode: "Hybrid",
      description: null,
      skills: []
    },
    {
      title: "Demand Planning Manager",
      company: "AB InBev India",
      employmentType: "Full-time",
      dateRange: "Jul 2020 - May 2022",
      duration: "1 yr 11 mos",
      location: "Bengaluru, Karnataka, India",
      workMode: null,
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

test("extracts experience skill association contracts", () => {
  const raw = [
    '1:{"children":["Experience"]}',
    '2:{"payload":{"vanityName":"example","associationType":"position","associationId":"2593285733","associationTitle":"Member Technical Staff -1 at Aquera","isVanityNameResolved":true},"requestMetadata":{"$type":"proto.sdui.common.RequestMetadata"}}',
    '3:{"payload":{"vanityName":"example","associationType":"education","associationId":"ignore","associationTitle":"Ignored","isVanityNameResolved":true},"requestMetadata":{"$type":"proto.sdui.common.RequestMetadata"}}',
    '4:{"payload":{"vanityName":"example","associationType":"position","associationId":"2593285733","associationTitle":"Member Technical Staff -1 at Aquera","isVanityNameResolved":true},"requestMetadata":{"$type":"proto.sdui.common.RequestMetadata"}}'
  ].join("\n");

  assert.deepEqual(extractExperienceSkillAssociations(raw), [
    {
      associationType: "position",
      associationId: "2593285733",
      associationTitle: "Member Technical Staff -1 at Aquera"
    }
  ]);
});

test("parses experience skill association details and removes duplicates/noise", () => {
  const raw = [
    '1:{"children":["Learn more about these skills"]}',
    '2:{"children":["Discover jobs, people, learning content and conversations about these skills"]}',
    '2a:{"aria-label":"Collapsed, Suggested content","children":["Suggested content"]}',
    '3:{"componentKey":"com.linkedin.sdui.profile.skill(ACoAAAExample123, 1760560923)","aria-label":"Collapsed, Node.js","children":["Node.js"]}',
    '4:{"componentKey":"com.linkedin.sdui.profile.skill(ACoAAAExample123, 1760560923)","aria-label":"Expanded, Node.js","children":["Node.js"]}',
    '5:{"componentKey":"com.linkedin.sdui.profile.skill(ACoAAAExample123, 4)","aria-label":"Collapsed, Amazon Web Services (AWS)","children":["Amazon Web Services (AWS)"]}',
    '6:{"componentKey":"com.linkedin.sdui.profile.skill(ACoAAAExample123, 5)","aria-label":"Collapsed, Express.js","children":["Express.js"]}',
    '7:{"componentKey":"com.linkedin.sdui.profile.skill(ACoAAAExample123, 6)","aria-label":"Collapsed, PostgreSQL","children":["PostgreSQL"]}',
    '8:{"componentKey":"com.linkedin.sdui.profile.skill(ACoAAAExample123, 1600533160)","aria-label":"Collapsed, JavaScript","children":["JavaScript"]}'
  ].join("\n");

  assert.deepEqual(parseExperienceSkillAssociationDetails(raw), [
    "Node.js",
    "Amazon Web Services (AWS)",
    "Express.js",
    "PostgreSQL",
    "JavaScript"
  ]);
});

test("parses experience association skills from component-local RSC refs", () => {
  const raw = [
    '1:["$","$L8",null,{"componentKey":"com.linkedin.sdui.profile.skill(ACoAAAExample123, 1760560923)","children":["$","div",null,{"children":["$","$L1a",null,{"children":[["$L1b"]]}]}]}]',
    '2:["$","$L8",null,{"componentKey":"com.linkedin.sdui.profile.skill(ACoAAAExample123, 4)","children":["$","div",null,{"children":["$","$L1a",null,{"children":[["$L25"]]}]}]}]',
    '3:["Collapsed",["$","$L8",null,{"componentKey":"unrelated-btn","aria-label":"Collapsed, Suggested content"}]]',
    '1b:["$","$L41",null,{"textProps":{"children":["Node.js"]}}]',
    '25:["$","$L41",null,{"textProps":{"children":["Amazon Web Services (AWS)"]}}]'
  ].join("\n");

  assert.deepEqual(parseExperienceSkillAssociationDetails(raw), [
    "Node.js",
    "Amazon Web Services (AWS)"
  ]);
});
