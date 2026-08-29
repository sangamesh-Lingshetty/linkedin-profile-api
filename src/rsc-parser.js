import { AppError } from "./linkedin-client.js";

const MONTHS = "Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec";
const EXPERIENCE_DATE_RANGE_RE = new RegExp(
  `\\b(?:${MONTHS})\\s+\\d{4}\\s+-\\s+(?:Present|(?:${MONTHS})\\s+\\d{4})\\b`,
  "i"
);
const EDUCATION_DATE_RANGE_RE = new RegExp(
  `\\b(?:${MONTHS})\\s+\\d{4}\\s+(?:-|\\u2013|\\u2014|\\u00e2\\u20ac\\u201c|\\u00e2\\u20ac\\u0093)\\s+(?:Present|(?:${MONTHS})\\s+\\d{4})\\b`,
  "i"
);
const DURATION_RE = /\b\d+\s+(?:yr|yrs|year|years|mo|mos|month|months)(?:\s+\d+\s+(?:mo|mos|month|months))?\b/i;
const SEPARATOR_RE = /\s*(?:\\u00b7|\u00b7|\u00c2\u00b7|\|)\s*/;
const EDUCATION_PAGER_ID = "com.linkedin.sdui.pagers.profile.details.education";
const SKILLS_PAGER_ID = "com.linkedin.sdui.pagers.profile.details.skills";
const CERTIFICATIONS_PAGER_ID = "com.linkedin.sdui.pagers.profile.details.certifications";

export function parseExperience(raw) {
  try {
    const texts = extractSimpleText(raw);
    const experiences = [];

    for (let i = 0; i < texts.length; i++) {
      const dateText = texts[i].text;

      if (!EXPERIENCE_DATE_RANGE_RE.test(dateText)) {
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
      const nextBoundary = findNextDateBoundary(texts, i, EXPERIENCE_DATE_RANGE_RE);
      const nearbyTexts = texts.slice(titleItem.position, nextBoundary);

      experiences.push({
        title: titleItem.text,
        company: companyParts[0],
        employmentType: companyParts[1],
        dateRange: dateParts[0],
        duration: dateParts[1] || extractDuration(dateText),
        location: locationParts.location,
        workMode: locationParts.workMode,
        description: extractExperienceDescription(nearbyTexts),
        skills: extractExperienceSkills(nearbyTexts)
      });
    }

    return dedupe(experiences, ["title", "company", "dateRange"]);
  } catch {
    throw new AppError("EXTRACTION_FAILED", "LinkedIn experience extraction failed.", 502);
  }
}

export function extractEducationPaginationInfo(raw) {
  const profileId = extractEducationProfileId(raw);
  const detailSectionReplaceableComponentRef = extractEducationDetailsSectionRef(raw);

  if (!profileId || !detailSectionReplaceableComponentRef || !raw.includes(EDUCATION_PAGER_ID)) {
    throw new AppError(
      "EXTRACTION_FAILED",
      "LinkedIn education pagination contract could not be extracted.",
      502
    );
  }

  return {
    profileId,
    detailSectionReplaceableComponentRef
  };
}

export function extractEducationProfileId(raw) {
  return extractStringValue(raw, "profileId");
}

export function extractEducationDetailsSectionRef(raw) {
  const direct = extractStringValue(raw, "detailSectionReplaceableComponentRef");
  if (direct && direct.endsWith("EducationDetailsSection")) {
    return direct;
  }

  const regex = /"((?:\\.|[^"\\])*EducationDetailsSection)"/g;
  let match;

  while ((match = regex.exec(raw))) {
    const value = clean(decode(match[1]));
    if (value && value.endsWith("EducationDetailsSection")) {
      return value;
    }
  }

  return null;
}

export function parseEducation(raw) {
  try {
    const texts = extractSimpleText(raw);
    const education = [];

    for (let i = 0; i < texts.length; i++) {
      if (!EDUCATION_DATE_RANGE_RE.test(texts[i].text)) {
        continue;
      }

      const degreeItem = findPreviousEducationText(texts, i - 1, 6);
      const schoolItem = degreeItem
        ? findPreviousEducationText(texts, degreeItem.position - 1, 8)
        : null;

      if (!schoolItem || !degreeItem) {
        continue;
      }

      const windowStart = Math.max(0, schoolItem.position - 10);
      const nextBoundary = findNextDateBoundary(texts, i, EDUCATION_DATE_RANGE_RE);
      const nearbyTexts = texts.slice(windowStart, nextBoundary);
      const nearbyRaw = raw.slice(texts[windowStart].index, texts[nextBoundary]?.index || raw.length);
      const degreeParts = splitDegree(degreeItem.text);

      education.push({
        school: schoolItem.text,
        degree: degreeParts.degree,
        fieldOfStudy: degreeParts.fieldOfStudy,
        dateRange: texts[i].text,
        grade: extractEducationGrade(nearbyTexts, nearbyRaw),
        activities: extractEducationActivities(nearbyTexts, nearbyRaw),
        description: extractEducationDescription(nearbyTexts, nearbyRaw),
        schoolLogo: extractSchoolLogo(nearbyRaw)
      });
    }

    return dedupe(education, ["school", "degree", "dateRange"]);
  } catch {
    throw new AppError("EXTRACTION_FAILED", "LinkedIn education extraction failed.", 502);
  }
}

export function extractSkillsProfileId(raw) {
  return extractStringValue(raw, "profileId");
}

export function parseSkills(raw) {
  try {
    const skills = [];
    const anchors = findSkillAnchors(raw);
    const textRefs = buildRscTextReferenceMap(raw);

    for (let i = 0; i < anchors.length; i++) {
      const anchor = anchors[i];
      const nextAnchor = anchors[i + 1];
      const chunkStart = anchor.index;
      const chunkEnd = nextAnchor ? nextAnchor.index : raw.length;
      const chunk = raw.slice(chunkStart, chunkEnd);
      const name = extractSkillName(chunk, raw, anchor.index, textRefs);

      if (!name) {
        continue;
      }

      skills.push({
        id: anchor.skillId,
        name
      });
    }

    return dedupe(skills, ["id", "name"]);
  } catch {
    throw new AppError("EXTRACTION_FAILED", "LinkedIn skills extraction failed.", 502);
  }
}

export function extractNextSkillsStart(raw) {
  const starts = extractPaginationStarts(raw, SKILLS_PAGER_ID);
  return starts.length > 0 ? starts[0] : null;
}

export function buildRscTextReferenceMap(raw) {
  const refs = {};
  const regex = /(?:^|\n)([A-Za-z0-9]+):\[[\s\S]*?(?=(?:\n[A-Za-z0-9]+:)|$)/g;
  let match;

  while ((match = regex.exec(raw))) {
    const key = match[1];
    const definition = match[0];
    const text = extractTextFromRscDefinition(definition);

    if (text && isSkillNameCandidate(text)) {
      refs[key] = text;
    }
  }

  return refs;
}

export function extractCertificationsProfileId(raw) {
  return extractStringValue(raw, "profileId");
}

export function extractNextCertificationsStart(raw) {
  const starts = extractPaginationStarts(raw, CERTIFICATIONS_PAGER_ID);
  return starts.length > 0 ? starts[0] : null;
}

export function parseCertifications(raw) {
  try {
    const anchors = findCertificationAnchors(raw);
    const certifications = [];

    for (let i = 0; i < anchors.length; i++) {
      const anchor = anchors[i];
      const nextAnchor = anchors[i + 1];
      const chunkStart = findCertificationChunkStart(raw, anchor.index);
      const chunkEnd = nextAnchor ? findCertificationChunkStart(raw, nextAnchor.index) : raw.length;
      const chunk = raw.slice(chunkStart, chunkEnd);
      const parsed = parseCertificationChunk(anchor.id, chunk);

      if (parsed.name || parsed.issuingOrganization || parsed.issueDate) {
        certifications.push(parsed);
      }
    }

    return dedupe(certifications, ["id"]);
  } catch {
    throw new AppError("EXTRACTION_FAILED", "LinkedIn certifications extraction failed.", 502);
  }
}

export function parseAboutResponse(raw) {
  try {
    if (!raw.includes("com.linkedin.sdui.flagshipnav.profile.ProfileAboutForm")) {
      return null;
    }

    const textRecords = extractRscTextRecords(raw);
    const refs = extractAboutRefs(raw);

    for (const ref of refs) {
      const text = textRecords[ref];

      if (text && !isAnyRscRef(text)) {
        return normalizeAboutText(text);
      }
    }

    return null;
  } catch {
    throw new AppError("EXTRACTION_FAILED", "LinkedIn about extraction failed.", 502);
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
    if (hasSeparator(texts[i].text) && !EXPERIENCE_DATE_RANGE_RE.test(texts[i].text)) {
      return i;
    }
  }

  return -1;
}

function findPreviousTitle(texts, companyIndex) {
  for (let i = companyIndex - 1; i >= Math.max(0, companyIndex - 6); i--) {
    const text = texts[i].text;

    if (isNoise(text) || hasSeparator(text) || EXPERIENCE_DATE_RANGE_RE.test(text)) {
      continue;
    }

    return {
      ...texts[i],
      position: i
    };
  }

  return null;
}

function findPreviousEducationText(texts, startIndex, maxDistance) {
  for (let i = startIndex; i >= Math.max(0, startIndex - maxDistance + 1); i--) {
    const text = texts[i].text;

    if (
      isNoise(text) ||
      isLogoText(text) ||
      EXPERIENCE_DATE_RANGE_RE.test(text) ||
      EDUCATION_DATE_RANGE_RE.test(text)
    ) {
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

    if (EXPERIENCE_DATE_RANGE_RE.test(text) || /^Skills:/i.test(text)) {
      return null;
    }

    if (hasSeparator(text) || isWorkMode(text)) {
      return text;
    }
  }

  return null;
}

function findNextDateBoundary(texts, dateIndex, dateRegex) {
  for (let i = dateIndex + 1; i < texts.length; i++) {
    if (dateRegex.test(texts[i].text)) {
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

function splitDegree(value) {
  const [degree, fieldOfStudy] = value.split(",").map(clean);

  return {
    degree: degree || null,
    fieldOfStudy: fieldOfStudy || null
  };
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

function extractExperienceSkills(texts) {
  const skillsText = texts.find((item) => /^Skills:/i.test(item.text))?.text;
  if (!skillsText) {
    return [];
  }

  return splitList(skillsText.replace(/^Skills:\s*/i, ""));
}

function extractExperienceDescription() {
  return null;
}

function extractEducationGrade(texts, raw) {
  return extractPrefixedValue(texts, /^Grade:\s*/i)
    || extractPrefixedValueFromStrings(extractDecodedStrings(raw), /^Grade:\s*/i);
}

function extractEducationActivities(texts, raw) {
  const direct = extractPrefixedValue(texts, /^Activities(?: and societies)?:\s*/i);
  if (direct) {
    return splitList(cleanActivityLabel(direct));
  }

  const strings = extractDecodedStrings(raw);
  const startIndex = strings.findIndex((value) => /^Activities(?: and societies)?:/i.test(value));
  if (startIndex === -1) {
    return [];
  }

  const firstValue = cleanActivityLabel(strings[startIndex].replace(/^Activities(?: and societies)?:\s*/i, ""));
  const activities = firstValue ? splitList(firstValue) : [];

  for (let i = startIndex + 1; i < strings.length; i++) {
    const value = clean(strings[i]);
    if (!value || isStringToken(value)) {
      continue;
    }

    if (/^(Grade:|Relevant Coursework:|Description:)/i.test(value)) {
      break;
    }

    if (isArrowBullet(value)) {
      activities.push(stripArrowBullet(value));
    }
  }

  return activities.filter(Boolean);
}

function extractEducationDescription(texts, raw) {
  const explicit = extractPrefixedValue(texts, /^Description:\s*/i);
  if (explicit) {
    return explicit;
  }

  const coursework = texts.find((item) => /^Relevant Coursework:/i.test(item.text));
  if (coursework) {
    return coursework.text;
  }

  const strings = extractDecodedStrings(raw);
  const startIndex = strings.findIndex((value) => /^(Description:|Relevant Coursework:)/i.test(value));
  if (startIndex === -1) {
    return null;
  }

  const firstPart = clean(strings[startIndex]);
  const parts = firstPart ? [firstPart] : [];

  for (let i = startIndex + 1; i < strings.length; i++) {
    const value = clean(strings[i]);
    if (!value || isStringToken(value)) {
      continue;
    }

    if (/^(Grade:|Activities(?: and societies)?:)/i.test(value)) {
      break;
    }

    parts.push(value);
    break;
  }

  return clean(parts.join(" "));
}

function extractPrefixedValue(texts, prefixRegex) {
  const item = texts.find((entry) => prefixRegex.test(entry.text));
  return item ? clean(item.text.replace(prefixRegex, "")) : null;
}

function splitList(value) {
  if (!value) {
    return [];
  }

  return value
    .split(/\s*(?:\u2022|\u00e2\u20ac\u00a2|\n|;)\s*/)
    .map(clean)
    .filter(Boolean);
}

function extractSchoolLogo(raw) {
  const image = extractLinkedInImage(raw);
  if (image) {
    return image;
  }

  const urls = raw.match(/https?:\/\/[^"\\\s]+/g) || [];
  const logo = urls.find((url) => /media\.licdn\.com|logo|image/i.test(url));

  return logo ? decode(logo) : null;
}

function extractLinkedInImage(raw) {
  const rootUrl = extractStringValue(raw, "rootUrl");
  if (!rootUrl) {
    return null;
  }

  const renditions = [];
  const regex = /"width"\s*:\s*(\d+)[\s\S]{0,120}?"height"\s*:\s*(\d+)[\s\S]{0,120}?"suffixUrl"\s*:\s*"((?:\\.|[^"\\])*)"/g;
  let match;

  while ((match = regex.exec(raw))) {
    renditions.push({
      width: Number(match[1]),
      height: Number(match[2]),
      suffixUrl: clean(decode(match[3]))
    });
  }

  const largest = renditions
    .filter((rendition) => rendition.suffixUrl)
    .sort((a, b) => (b.width * b.height) - (a.width * a.height))[0];

  return largest ? `${rootUrl}${largest.suffixUrl}` : rootUrl;
}

function extractLinkedInImages(raw) {
  const images = [];
  const regex = /"rootUrl"\s*:\s*"((?:\\.|[^"\\])*)"[\s\S]{0,2500}?"imageRenditions"\s*:\s*\[([\s\S]*?)\]/g;
  let match;

  while ((match = regex.exec(raw))) {
    const rootUrl = clean(decode(match[1]));
    const renditionsRaw = match[2];
    const renditions = [];
    const renditionRegex = /"width"\s*:\s*(\d+)[\s\S]{0,120}?"height"\s*:\s*(\d+)[\s\S]{0,120}?"suffixUrl"\s*:\s*"((?:\\.|[^"\\])*)"/g;
    let renditionMatch;

    while ((renditionMatch = renditionRegex.exec(renditionsRaw))) {
      renditions.push({
        width: Number(renditionMatch[1]),
        height: Number(renditionMatch[2]),
        suffixUrl: clean(decode(renditionMatch[3]))
      });
    }

    const largest = renditions
      .filter((rendition) => rootUrl && rendition.suffixUrl)
      .sort((a, b) => (b.width * b.height) - (a.width * a.height))[0];

    if (rootUrl && largest) {
      images.push({
        url: `${rootUrl}${largest.suffixUrl}`,
        area: largest.width * largest.height,
        index: match.index
      });
    }
  }

  return images;
}

function findCertificationAnchors(raw) {
  const anchors = [];
  const patterns = [
    /"certificationId"\s*:\s*"(\d+)"/g,
    /\/details\/certifications\/edit\/forms\/(\d+)\//g
  ];

  for (const regex of patterns) {
    let match;

    while ((match = regex.exec(raw))) {
      anchors.push({
        id: match[1],
        index: match.index
      });
    }
  }

  return anchors
    .sort((a, b) => a.index - b.index)
    .filter((anchor, index, all) => all.findIndex((item) => item.id === anchor.id) === index);
}

function findCertificationChunkStart(raw, anchorIndex) {
  const lockupIndex = raw.lastIndexOf("license-certifications-lockup-view", anchorIndex);
  if (lockupIndex !== -1) {
    return lockupIndex;
  }

  return Math.max(0, anchorIndex - 1200);
}

function parseCertificationChunk(id, chunk) {
  const simpleTexts = extractSimpleText(chunk)
    .map((item) => item.text)
    .filter(isCertificationTextCandidate);
  const strings = simpleTexts.length > 0
    ? simpleTexts
    : extractDecodedStrings(chunk)
      .map(clean)
      .filter(Boolean)
      .filter(isCertificationTextCandidate);
  const issueLine = strings.find((value) => /^Issued\s+/i.test(value)) || null;
  const issueParts = parseCertificationDates(issueLine);
  const credentialId = extractPrefixedValueFromStrings(strings, /^Credential ID\s*/i);
  const credentialUrl = extractCertificationCredentialUrl(chunk);
  const images = extractLinkedInImages(chunk);
  const issuerLogo = pickIssuerLogo(images);
  const media = extractCertificationMedia(chunk, images);
  const mainTexts = strings.filter((value) =>
    value !== issueLine &&
    value !== credentialId &&
    !/^Credential ID/i.test(value) &&
    !/^Show credential$/i.test(value) &&
    !isCertificationMediaName(value) &&
    !isCertificationHeading(value)
  );

  return {
    id,
    name: mainTexts[0] || null,
    issuingOrganization: mainTexts[1] || null,
    issueDate: issueParts.issueDate,
    expirationDate: issueParts.expirationDate,
    credentialId,
    credentialUrl,
    issuerLogo,
    media
  };
}

function parseCertificationDates(value) {
  if (!value) {
    return {
      issueDate: null,
      expirationDate: null
    };
  }

  const parts = value.split(SEPARATOR_RE).map(clean).filter(Boolean);
  const issued = parts.find((part) => /^Issued\s+/i.test(part));
  const expires = parts.find((part) => /^Expires\s+/i.test(part));

  return {
    issueDate: issued ? clean(issued.replace(/^Issued\s+/i, "")) : null,
    expirationDate: expires ? clean(expires.replace(/^Expires\s+/i, "")) : null
  };
}

function extractCertificationCredentialUrl(raw) {
  const urls = raw.match(/https?:\/\/[^"\\\s]+/g) || [];
  const credential = urls.find(isCredentialUrl);

  return credential ? decode(credential) : null;
}

function pickIssuerLogo(images) {
  return images
    .filter((image) => /company-logo|logo/i.test(image.url))
    .sort((a, b) => b.area - a.area)[0]?.url || null;
}

function extractCertificationMedia(raw, images) {
  const names = extractSimpleText(raw)
    .map((item) => item.text)
    .filter(Boolean)
    .filter(isCertificationMediaName);
  const mediaImages = images.filter((image) => !/company-logo|logo/i.test(image.url));

  return mediaImages.map((image, index) => ({
    name: names[index] || null,
    url: image.url
  }));
}

function findSkillAnchors(raw) {
  const anchors = [];
  const regex = /com\.linkedin\.sdui\.profile\.skill\(\s*([^,\s)]+)\s*,\s*([^)]+?)\s*\)/g;
  let match;

  while ((match = regex.exec(raw))) {
    const skillId = clean(match[2]);
    if (skillId) {
      anchors.push({
        skillId,
        index: match.index
      });
    }
  }

  return anchors;
}

function extractSkillName(chunk, raw, anchorIndex, textRefs) {
  const ref = extractSkillTitleRef(chunk);
  const resolved = ref ? textRefs[ref] : null;

  if (resolved && isSkillNameCandidate(resolved)) {
    return resolved;
  }

  if (ref) {
    return null;
  }

  const chunkTexts = extractSimpleText(chunk);
  const chunkName = chunkTexts.find((item) => isSkillNameCandidate(item.text) && !isRscRef(item.text))?.text;

  if (chunkName) {
    return chunkName;
  }

  const before = raw.slice(Math.max(0, anchorIndex - 800), anchorIndex);
  const beforeTexts = extractSimpleText(before);

  return beforeTexts
    .map((item) => item.text)
    .reverse()
    .find((text) => isSkillNameCandidate(text) && !isRscRef(text)) || null;
}

function extractSkillTitleRef(chunk) {
  const childrenRef = /"children"\s*:\s*\[\s*"\$L([A-Za-z0-9]+)"\s*\]/.exec(chunk);
  if (childrenRef) {
    return childrenRef[1];
  }

  const textRef = /"\$L([A-Za-z0-9]+)"/.exec(chunk);
  return textRef ? textRef[1] : null;
}

function extractTextFromRscDefinition(definition) {
  const patterns = [
    /"textProps"\s*:\s*\{[\s\S]*?"children"\s*:\s*\[\s*"((?:\\.|[^"\\])*)"\s*\]/,
    /"children"\s*:\s*\[\s*"((?:\\.|[^"\\])*)"\s*\]/,
    /"children"\s*:\s*"((?:\\.|[^"\\])*)"/
  ];

  for (const pattern of patterns) {
    const match = pattern.exec(definition);
    const text = clean(decode(match && match[1]));

    if (text && !isRscRef(text)) {
      return text;
    }
  }

  return null;
}

function extractPaginationStarts(raw, pagerId) {
  const starts = [];
  const pagerIndex = raw.indexOf(pagerId);

  if (pagerIndex === -1) {
    return starts;
  }

  const searchArea = raw.slice(pagerIndex);
  const patterns = [
    /"start"\s*:\s*(\d+)/g,
    /\\"start\\"\s*:\s*(\d+)/g
  ];

  for (const regex of patterns) {
    let match;

    while ((match = regex.exec(searchArea))) {
      const start = Number(match[1]);
      if (Number.isInteger(start) && start > 0) {
        starts.push(start);
      }
    }
  }

  return [...new Set(starts)].sort((a, b) => a - b);
}

function extractStringValue(raw, key) {
  const patterns = [
    new RegExp(`"${key}"\\s*:\\s*"((?:\\\\.|[^"\\\\])*)"`),
    new RegExp(`\\\\"${key}\\\\"\\s*:\\s*\\\\"((?:\\\\.|[^"\\\\])*)\\\\"`)
  ];

  for (const pattern of patterns) {
    const match = pattern.exec(raw);
    const value = clean(decode(match && match[1]));

    if (value) {
      return value;
    }
  }

  return null;
}

function extractRscTextRecords(raw) {
  const records = {};
  const regex = /(?:^|\n)([A-Za-z0-9]+):T\d+,([\s\S]*?)(?=\n[A-Za-z0-9]+:|$)/g;
  let match;

  while ((match = regex.exec(raw))) {
    const key = match[1];
    const value = normalizeAboutText(decodeTextRecord(match[2]));

    if (value) {
      records[key] = value;
    }
  }

  return records;
}

function extractAboutRefs(raw) {
  const refs = [];
  const aboutContexts = raw.match(/.{0,250}(?:about|initialAbout)[^"'\\]*AboutForm.{0,500}/gi) || [];

  for (const context of aboutContexts) {
    const regex = /"\$(L?[A-Za-z0-9]+)"/g;
    let match;

    while ((match = regex.exec(context))) {
      refs.push(match[1].replace(/^L/, ""));
    }
  }

  return [...new Set(refs)];
}

function decodeTextRecord(value) {
  return value
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\r")
    .replace(/\\t/g, "\t")
    .replace(/\\"/g, "\"")
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, code) =>
      String.fromCharCode(Number.parseInt(code, 16))
    )
    .replace(/&amp;/g, "&");
}

function normalizeAboutText(value) {
  return value
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .trim();
}

function extractPrefixedValueFromStrings(strings, prefixRegex) {
  const item = strings.find((value) => prefixRegex.test(value));
  return item ? clean(item.replace(prefixRegex, "")) : null;
}

function extractDecodedStrings(raw) {
  const strings = [];
  const regex = /"((?:\\.|[^"\\])*)"/g;
  let match;

  while ((match = regex.exec(raw))) {
    const value = clean(decode(match[1]));
    if (value) {
      strings.push(value);
    }
  }

  return strings;
}

function cleanActivityLabel(value) {
  return clean(value?.replace(/^Activities:\s*/i, ""));
}

function isArrowBullet(value) {
  return /^(?:\u2192|\u00e2\u0086\u0092|â†’)\s*/.test(value);
}

function stripArrowBullet(value) {
  return clean(value.replace(/^(?:\u2192|\u00e2\u0086\u0092|â†’)\s*/, ""));
}

function isStringToken(value) {
  return (
    value === "$" ||
    value === "br" ||
    value === "p" ||
    value === "div" ||
    /^\$L?[0-9a-f]+$/i.test(value) ||
    /^[0-9a-f]$/i.test(value) ||
    /^[a-z0-9_-]{16,}$/i.test(value) ||
    /^(className|children|textProps|fontFamily|fontSize|fontStyle|fontWeight|lineHeight|textAlign)$/i.test(value)
  );
}

function isWorkMode(value) {
  return /^(Remote|Hybrid|On-site|Onsite)$/i.test(value);
}

function hasSeparator(value) {
  return SEPARATOR_RE.test(value);
}

function isLogoText(value) {
  return /logo|image|photo/i.test(value);
}

function isNoise(value) {
  return /^(Experience|Education|Skills|Show all|See more|See less|advertisement)$/i.test(value);
}

function isSkillNameCandidate(value) {
  return (
    value.length > 1 &&
    value.length < 140 &&
    !isNoise(value) &&
    !isRscRef(value) &&
    !/^Endorsed by/i.test(value) &&
    !/endorsement/i.test(value) &&
    !/^\d+$/.test(value) &&
    !/^com\.linkedin\./i.test(value)
  );
}

function isRscRef(value) {
  return /^\$L[a-zA-Z0-9]+$/.test(value);
}

function isAnyRscRef(value) {
  return /^\$L?[a-zA-Z0-9]+$/.test(value);
}

function isCertificationTextCandidate(value) {
  return (
    value.length > 1 &&
    value.length < 220 &&
    !isNoise(value) &&
    !isStringToken(value) &&
    !isRscRef(value) &&
    !isCertificationHeading(value) &&
    !/^Edit\s+/i.test(value) &&
    !/^license-certifications-/i.test(value) &&
    !/^com\.linkedin\./i.test(value) &&
    !/^https?:\/\//i.test(value) &&
    !/^(url|urlValue|payload|certificationId|profileId|children|renderPayload|imageRenditions|rootUrl|suffixUrl|width|height)$/i.test(value)
  );
}

function isCertificationHeading(value) {
  return /^(Licenses\s*&\s*certifications|Licenses and certifications)$/i.test(value);
}

function isCertificationMediaName(value) {
  return /\.(?:png|jpe?g|webp|gif|pdf)$/i.test(value);
}

function isCredentialUrl(url) {
  return (
    !/media\.licdn\.com|licdn\.com\/dms\/image/i.test(url) &&
    !/^https?:\/\/(?:www\.)?linkedin\.com\/company\//i.test(url)
  );
}

function dedupe(entries, keys) {
  const seen = new Set();

  return entries.filter((entry) => {
    const key = keys.map((field) => entry[field]).join("|").toLowerCase();
    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function decode(value) {
  if (!value) {
    return value;
  }

  try {
    return JSON.parse(`"${value}"`);
  } catch {
    return value;
  }
}

function clean(value) {
  const cleaned = value
    ?.replace(/&amp;/g, "&")
    .replace(/\\n/g, "\n")
    .replace(/\r?\n+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/^["':\s]+|["'\s]+$/g, "")
    .trim();

  return cleaned || null;
}
