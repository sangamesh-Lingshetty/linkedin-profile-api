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
