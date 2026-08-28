import { AppError } from "./linkedin-client.js";

const MONTHS = "Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec";
const DATE_RANGE_RE = new RegExp(
  `\\b(?:${MONTHS})\\s+\\d{4}\\s+-\\s+(?:Present|(?:${MONTHS})\\s+\\d{4})\\b`,
  "i"
);
const DURATION_RE = /\b\d+\s+(?:yr|yrs|year|years|mo|mos|month|months)(?:\s+\d+\s+(?:mo|mos|month|months))?\b/i;
const SEPARATOR_RE = /\s*(?:\\u00b7|\u00b7|Â·|\|)\s*/;

export function parseExperience(raw) {
  try {
    const texts = extractSimpleText(raw);
    const experiences = [];

    for (let i = 0; i < texts.length; i++) {
      const dateText = texts[i].text;

      if (!DATE_RANGE_RE.test(dateText)) {
        continue;
      }

      const companyIndex = findPreviousCompanyIndex(texts, i);
      if (companyIndex === -1) {
        continue;
      }

      const titleItem = findPreviousTitle(texts, companyIndex);
      if (!titleItem) {
        continue;
      }

      const companyParts = splitOnce(texts[companyIndex].text);
      const dateParts = splitOnce(dateText);
      const locationParts = parseLocation(findNextLocation(texts, i));
      const nextBoundary = findNextDateBoundary(texts, i);
      const nearbyTexts = texts.slice(titleItem.position, nextBoundary);

      experiences.push({
        title: titleItem.text,
        company: companyParts[0],
        employmentType: companyParts[1],
        dateRange: dateParts[0],
        duration: dateParts[1] || extractDuration(dateText),
        location: locationParts.location,
        workMode: locationParts.workMode,
        description: extractDescription(nearbyTexts),
        skills: extractSkills(nearbyTexts)
      });
    }

    return dedupe(experiences);
  } catch {
    throw new AppError("EXTRACTION_FAILED", "LinkedIn experience extraction failed.", 502);
  }
}

function extractSimpleText(raw) {
  const values = [];
  const patterns = [
    /"children"\s*:\s*\[\s*"((?:\\.|[^"\\])*)"\s*\]/g,
    /"children"\s*:\s*"((?:\\.|[^"\\])*)"/g
  ];

  for (const regex of patterns) {
    let match;

    while ((match = regex.exec(raw))) {
      const text = clean(decode(match[1]));
      if (text) {
        values.push({
          text,
          index: match.index
        });
      }
    }
  }

  return values
    .sort((a, b) => a.index - b.index)
    .map((item, position) => ({ ...item, position }));
}

function findPreviousCompanyIndex(texts, dateIndex) {
  for (let i = dateIndex - 1; i >= Math.max(0, dateIndex - 8); i--) {
    if (hasSeparator(texts[i].text) && !DATE_RANGE_RE.test(texts[i].text)) {
      return i;
    }
  }

  return -1;
}

function findPreviousTitle(texts, companyIndex) {
  for (let i = companyIndex - 1; i >= Math.max(0, companyIndex - 6); i--) {
    const text = texts[i].text;

    if (isNoise(text) || hasSeparator(text) || DATE_RANGE_RE.test(text)) {
      continue;
    }

    return {
      ...texts[i],
      position: i
    };
  }

  return null;
}

function findNextLocation(texts, dateIndex) {
  for (let i = dateIndex + 1; i < Math.min(texts.length, dateIndex + 6); i++) {
    const text = texts[i].text;

    if (DATE_RANGE_RE.test(text) || /^Skills:/i.test(text)) {
      return null;
    }

    if (hasSeparator(text) || isWorkMode(text)) {
      return text;
    }
  }

  return null;
}

function findNextDateBoundary(texts, dateIndex) {
  for (let i = dateIndex + 1; i < texts.length; i++) {
    if (DATE_RANGE_RE.test(texts[i].text)) {
      return Math.max(dateIndex + 1, i - 2);
    }
  }

  return texts.length;
}

function parseLocation(value) {
  if (!value) {
    return { location: null, workMode: null };
  }

  const [location, workMode] = splitOnce(value);

  if (!workMode && isWorkMode(location)) {
    return { location, workMode: location };
  }

  return { location, workMode };
}

function splitOnce(value) {
  const parts = value.split(SEPARATOR_RE).map(clean).filter(Boolean);

  if (parts.length === 0) {
    return [null, null];
  }

  if (parts.length === 1) {
    return [parts[0], null];
  }

  return [parts[0], parts.slice(1).join(" ")];
}

function extractDuration(value) {
  const match = DURATION_RE.exec(value);
  return clean(match && match[0]);
}

function extractSkills(texts) {
  const skillsText = texts.find((item) => /^Skills:/i.test(item.text))?.text;
  if (!skillsText) {
    return [];
  }

  return skillsText
    .replace(/^Skills:\s*/i, "")
    .split(/\s*(?:\u2022|â€¢|,|;)\s*/)
    .map(clean)
    .filter(Boolean);
}

function extractDescription() {
  return null;
}

function isWorkMode(value) {
  return /^(Remote|Hybrid|On-site|Onsite)$/i.test(value);
}

function hasSeparator(value) {
  return SEPARATOR_RE.test(value);
}

function isNoise(value) {
  return /^(Experience|Skills|Show all|See more|See less|advertisement)$/i.test(value);
}

function dedupe(entries) {
  const seen = new Set();

  return entries.filter((entry) => {
    const key = [entry.title, entry.company, entry.dateRange].join("|").toLowerCase();
    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function decode(value) {
  try {
    return JSON.parse(`"${value}"`);
  } catch {
    return value;
  }
}

function clean(value) {
  const cleaned = value
    ?.replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .replace(/^["':\s]+|["'\s]+$/g, "")
    .trim();

  return cleaned || null;
}
