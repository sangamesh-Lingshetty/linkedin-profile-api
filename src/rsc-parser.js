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
const LANGUAGES_PAGER_ID = "com.linkedin.sdui.pagers.profile.details.languages";

export function parseExperience(raw) {
  try {
    const items = extractStructuralItems(raw);
    const experiences = [];
    let activeParent = null;
    let pendingTitle = null;
    let pendingCompanyLine = null;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const texts = item.texts.filter((text) => !isExperienceParserNoise(text));
      const dateIndex = texts.findIndex((text) => EXPERIENCE_DATE_RANGE_RE.test(text));

      if (texts.length === 0) {
        continue;
      }

      if (isExperienceGroupParent(texts)) {
        activeParent = parseExperienceGroupParent(texts);
        pendingTitle = null;
        pendingCompanyLine = null;
        continue;
      }

      if (dateIndex === -1) {
        if (texts.length === 1 && isRoleTitleCandidate(texts[0])) {
          pendingTitle = texts[0];
          continue;
        }

        if (texts.length === 1 && isCompanyEmploymentLine(texts[0])) {
          pendingCompanyLine = texts[0];
          activeParent = null;
          continue;
        }

        continue;
      }

      const parsed = parseExperienceItem(
        texts,
        dateIndex,
        activeParent,
        pendingTitle,
        pendingCompanyLine,
        items,
        i
      );

      pendingTitle = null;
      pendingCompanyLine = null;

      if (!parsed.title || !parsed.dateRange) {
        continue;
      }

      experiences.push(parsed);
    }

    const structuralEntries = dedupe(experiences.filter(isValidExperienceEntry), [
      "title",
      "company",
      "dateRange"
    ]);
    const flatEntries = parseFlatExperience(raw).filter(isValidExperienceEntry);
    const cleanStructuralEntries = structuralEntries.filter((entry) =>
      !isSuspiciousStructuredExperience(entry, flatEntries)
    );

    return dedupe([...cleanStructuralEntries, ...flatEntries], ["title", "company", "dateRange"]);
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
    const items = extractStructuralItems(raw);
    const education = [];
    let current = null;
    let pendingLogo = null;
    let pendingExtras = emptyEducationExtras();

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const texts = item.texts.filter((text) => !isEducationParserNoise(text));
      const first = texts[0];

      if (item.image) {
        if (current && !current.schoolLogo) {
          current.schoolLogo = item.image;
        } else {
          pendingLogo = item.image;
        }
      }

      if (texts.length === 0) {
        continue;
      }

      if (isEducationSchoolStart(items, i)) {
        if (current) {
          education.push(normalizeEducationEntry(current));
        }

        current = {
          school: first,
          degree: null,
          fieldOfStudy: null,
          dateRange: null,
          grade: pendingExtras.grade,
          activities: [...pendingExtras.activities],
          description: pendingExtras.description,
          schoolLogo: pendingLogo
        };
        applyEducationTexts(current, texts.slice(1));
        pendingLogo = null;
        pendingExtras = emptyEducationExtras();
        continue;
      }

      const target = current || pendingExtras;
      applyEducationTexts(target, texts);
    }

    if (current) {
      education.push(normalizeEducationEntry(current));
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

export function extractLanguagesProfileId(raw) {
  return extractStringValue(raw, "profileId");
}

export function extractNextLanguagesStart(raw) {
  const starts = extractPaginationStarts(raw, LANGUAGES_PAGER_ID);
  return starts.length > 0 ? starts[0] : null;
}

export function parseLanguages(raw) {
  try {
    const languages = [];
    let pendingName = null;

    for (const item of extractSimpleText(raw)) {
      const texts = [item.text]
        .map(clean)
        .filter(Boolean)
        .filter(isLanguageTextCandidate);

      if (texts.length === 0) {
        continue;
      }

      const parsed = texts.length > 1 ? parseLanguageTexts(texts) : null;
      if (parsed) {
        languages.push(parsed);
        pendingName = null;
        continue;
      }

      if (texts.length === 1 && pendingName && isLanguageProficiency(texts[0])) {
        languages.push({
          name: pendingName,
          proficiency: texts[0]
        });
        pendingName = null;
        continue;
      }

      if (texts.length === 1 && isLanguageNameCandidate(texts[0])) {
        if (pendingName) {
          languages.push({
            name: pendingName,
            proficiency: null
          });
        }

        pendingName = texts[0];
        continue;
      }
    }

    if (pendingName) {
      languages.push({
        name: pendingName,
        proficiency: null
      });
    }

    return dedupe(languages, ["name"]);
  } catch {
    throw new AppError("EXTRACTION_FAILED", "LinkedIn languages extraction failed.", 502);
  }
}

export function parseAboutResponse(raw) {
  try {
    return parseProfileCardAbout(raw);
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

function parseLanguageTexts(texts) {
  const nameIndex = texts.findIndex(isLanguageNameCandidate);

  if (nameIndex === -1) {
    return null;
  }

  const proficiency = texts.slice(nameIndex + 1).find(isLanguageProficiency) || null;

  return {
    name: texts[nameIndex],
    proficiency
  };
}

function isLanguageTextCandidate(value) {
  return (
    Boolean(value) &&
    !value.startsWith("$") &&
    !isNoise(value) &&
    !isRscRef(value) &&
    !isAnyRscRef(value) &&
    !/^(Nothing to see for now|Languages that .+ adds will appear here\.)$/i.test(value) &&
    !/^Add language$/i.test(value) &&
    !/^Edit language$/i.test(value) &&
    !/^(?:pagerId|paginationRequest|requestedArguments|payload|vanityName|profileId|start|count|screenId|knownTemplateIds|requestMetadata|states|key|value|namespace|MemoryNamespace)$/i.test(value) &&
    !/^com\.linkedin\./i.test(value) &&
    !/^https?:\/\//i.test(value)
  );
}

function isLanguageNameCandidate(value) {
  return (
    Boolean(value) &&
    value.length > 1 &&
    value.length < 80 &&
    !isLanguageProficiency(value) &&
    !isLanguageTextNoise(value)
  );
}

function isLanguageProficiency(value) {
  return /\bproficiency$/i.test(value || "");
}

function isLanguageTextNoise(value) {
  return /^(Languages|advertisement|Privacy Policy|User Agreement|Pages Terms|Cookie Policy|Copyright Policy)$/i.test(value);
}

function extractStructuralItems(raw) {
  const records = extractRscRecordList(raw);
  const byId = new Map(records.map((record) => [record.id, record]));
  const compositeTextRefs = new Set();

  for (const record of records) {
    const childTexts = directChildTexts(record, byId);

    if (isCompactCompositeRecord(record, childTexts)) {
      for (const child of directTextChildren(record, byId)) {
        compositeTextRefs.add(child.id);
      }
    }
  }

  const items = [];

  for (const record of records) {
    const ownTexts = extractRecordTexts(record.value);
    const childTexts = directChildTexts(record, byId);

    if (isCompactCompositeRecord(record, childTexts)) {
      items.push({
        id: record.id,
        texts: childTexts,
        image: extractLinkedInImage(record.value)
      });
      continue;
    }

    if (ownTexts.length > 0 && !compositeTextRefs.has(record.id)) {
      items.push({
        id: record.id,
        texts: ownTexts,
        image: extractLinkedInImage(record.value)
      });
      continue;
    }

    const image = extractLinkedInImage(record.value);
    if (image) {
      items.push({
        id: record.id,
        texts: [],
        image
      });
    }
  }

  return items;
}

function extractRscRecordList(raw) {
  const records = [];
  const regex = /(?:^|\n)([A-Za-z0-9]+):([\s\S]*?)(?=\n[A-Za-z0-9]+:|$)/g;
  let match;

  while ((match = regex.exec(raw))) {
    records.push({
      id: match[1],
      value: decodeTextRecord(match[2])
    });
  }

  return records;
}

function isCompactCompositeRecord(record, childTexts) {
  return (
    childTexts.length >= 2 &&
    childTexts.length <= 5 &&
    (
      record.value.length < 8000 ||
      childTexts.some((text) => EXPERIENCE_DATE_RANGE_RE.test(text) || EDUCATION_DATE_RANGE_RE.test(text)) ||
      childTexts.some(isCompanyEmploymentLine)
    )
  );
}

function directChildTexts(record, byId) {
  return directTextChildren(record, byId).flatMap((child) => extractRecordTexts(child.value));
}

function directTextChildren(record, byId) {
  return extractLocalRefs(record.value)
    .map((ref) => byId.get(ref))
    .filter(Boolean)
    .filter((child) => extractRecordTexts(child.value).length > 0);
}

function extractLocalRefs(value) {
  const refs = [];
  const regex = /"\$L([A-Za-z0-9]+)"/g;
  let match;

  while ((match = regex.exec(value))) {
    refs.push(match[1]);
  }

  return [...new Set(refs)];
}

function extractRecordTexts(record) {
  const simpleTexts = extractSimpleText(record).map((item) => item.text);
  const texts = simpleTexts.length > 0
    ? simpleTexts
    : extractNestedRecordTexts(record);

  return [...new Set(texts)]
    .map(clean)
    .filter((text) => text && !isRscRef(text) && text !== "$");
}

function extractNestedRecordTexts(record) {
  if (!record.includes("\"children\"") && !record.includes("\"textProps\"")) {
    return [];
  }

  return extractDecodedStrings(record).filter(isVisibleStructuralText);
}

function parseFlatExperience(raw) {
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
      duration: DURATION_RE.test(dateParts[1] || "") ? dateParts[1] : extractDuration(dateText),
      location: locationParts.location,
      workMode: locationParts.workMode,
      description: extractExperienceDescription(nearbyTexts),
      skills: extractExperienceSkills(nearbyTexts)
    });
  }

  return dedupe(experiences, ["title", "company", "dateRange"]);
}

function isValidExperienceEntry(entry) {
  return (
    Boolean(entry.title) &&
    Boolean(entry.dateRange) &&
    !isLocationLike(entry.company) &&
    !isEmploymentType(entry.company) &&
    !DURATION_RE.test(entry.company || "") &&
    !DURATION_RE.test(entry.employmentType || "")
  );
}

function isSuspiciousStructuredExperience(entry, flatEntries) {
  const replacement = flatEntries.find((flatEntry) => flatEntry.dateRange === entry.dateRange);

  return (
    Boolean(replacement) &&
    (
      !entry.employmentType ||
      isLongSentence(entry.location) ||
      (entry.company && !isCompanyEmploymentLine(`${entry.company} · ${entry.employmentType || ""}`))
    )
  );
}

function isLongSentence(value) {
  return Boolean(value) && value.length > 90 && /[.!?]/.test(value);
}

function isExperienceGroupParent(texts) {
  return (
    texts.length >= 2 &&
    isCompanyNameCandidate(texts[0]) &&
    isCompanySummaryLine(texts[1]) &&
    !EXPERIENCE_DATE_RANGE_RE.test(texts[1])
  );
}

function parseExperienceGroupParent(texts) {
  const summaryParts = splitOnce(texts[1]);
  const locationText = texts.find((text, index) => index > 1 && isLocationLine(text));
  const locationParts = isWorkMode(locationText)
    ? { location: null, workMode: locationText }
    : parseLocation(locationText);

  return {
    company: texts[0],
    employmentType: isEmploymentType(summaryParts[0]) ? summaryParts[0] : null,
    location: locationParts.location,
    workMode: locationParts.workMode
  };
}

function parseExperienceItem(
  texts,
  dateIndex,
  activeParent,
  pendingTitle,
  pendingCompanyLine,
  items,
  itemIndex
) {
  const dateParts = splitOnce(texts[dateIndex]);
  const inItemTitle = findRoleTitleBeforeDate(texts, dateIndex);
  const inItemCompanyLine = texts.slice(0, dateIndex).find(isCompanyEmploymentLine);
  const title = inItemTitle || pendingTitle;
  const companyLine = inItemCompanyLine || pendingCompanyLine;
  const companyParts = companyLine ? splitOnce(companyLine) : [null, null];
  const lookaheadTexts = collectExperienceLookaheadTexts(items, itemIndex);
  const locationText =
    texts.slice(dateIndex + 1).find(isLocationLine) ||
    lookaheadTexts.find(isLocationLine) ||
    null;
  const locationParts = parseLocation(locationText);
  const skills = extractExperienceSkillsFromValues([...texts, ...lookaheadTexts]);

  return {
    title,
    company: companyParts[0] || activeParent?.company || null,
    employmentType: companyParts[1] || activeParent?.employmentType || null,
    dateRange: dateParts[0],
    duration: DURATION_RE.test(dateParts[1] || "") ? dateParts[1] : extractDuration(texts[dateIndex]),
    location: locationParts.location || activeParent?.location || null,
    workMode: locationParts.workMode || activeParent?.workMode || null,
    description: null,
    skills
  };
}

function findRoleTitleBeforeDate(texts, dateIndex) {
  for (let i = dateIndex - 1; i >= 0; i--) {
    const text = texts[i];

    if (isRoleTitleCandidate(text)) {
      return text;
    }
  }

  return null;
}

function collectExperienceLookaheadTexts(items, itemIndex) {
  const texts = [];

  for (let i = itemIndex + 1; i < Math.min(items.length, itemIndex + 5); i++) {
    const nextTexts = items[i].texts.filter((text) => !isExperienceParserNoise(text));

    if (nextTexts.some((text) => EXPERIENCE_DATE_RANGE_RE.test(text)) || isExperienceGroupParent(nextTexts)) {
      break;
    }

    texts.push(...nextTexts);
  }

  return texts;
}

function extractExperienceSkillsFromValues(values) {
  const skillsText = values.find((text) => /^Skills:/i.test(text));
  if (!skillsText) {
    return [];
  }

  return splitList(skillsText.replace(/^Skills:\s*/i, ""));
}

function isCompanyEmploymentLine(value) {
  const parts = value.split(SEPARATOR_RE).map(clean).filter(Boolean);
  return parts.length >= 2 && isCompanyNameCandidate(parts[0]) && isEmploymentType(parts[1]);
}

function isCompanySummaryLine(value) {
  const parts = value.split(SEPARATOR_RE).map(clean).filter(Boolean);
  return parts.some(isEmploymentType) || parts.some((part) => DURATION_RE.test(part));
}

function isRoleTitleCandidate(value) {
  return (
    Boolean(value) &&
    value.length > 1 &&
    value.length < 180 &&
    !isNoise(value) &&
    !isExperienceParserNoise(value) &&
    !EXPERIENCE_DATE_RANGE_RE.test(value) &&
    !isCompanyEmploymentLine(value) &&
    !isCompanySummaryLine(value) &&
    !isLocationLine(value) &&
    !/^Skills:/i.test(value)
  );
}

function isCompanyNameCandidate(value) {
  return (
    Boolean(value) &&
    value.length > 1 &&
    value.length < 180 &&
    !isNoise(value) &&
    !isEmploymentType(value) &&
    !isLocationLike(value) &&
    !DURATION_RE.test(value) &&
    !EXPERIENCE_DATE_RANGE_RE.test(value) &&
    !/^Skills:/i.test(value)
  );
}

function isExperienceParserNoise(value) {
  return (
    isRscRef(value) ||
    /^(Experience|LinkedIn helped me get this job|Privacy Policy|User Agreement|Pages Terms|Cookie Policy|Copyright Policy)$/i.test(value)
  );
}

function isLocationLine(value) {
  return isLocationLike(value) || value.split(SEPARATOR_RE).some(isWorkMode);
}

function isLocationLike(value) {
  return (
    Boolean(value) &&
    (
      isWorkMode(value) ||
      /,\s*[A-Za-z]/.test(value) ||
      /\b(?:Remote|On-site|Onsite|Hybrid|Bengaluru|Bangalore|India|Karnataka|Mysore|Road)\b/i.test(value)
    )
  );
}

function isEmploymentType(value) {
  return /^(Full-time|Part-time|Contract|Internship|Freelance|Self-employed|Temporary|Apprenticeship)$/i.test(value || "");
}

function emptyEducationExtras() {
  return {
    grade: null,
    activities: [],
    description: null
  };
}

function isEducationSchoolStart(items, index) {
  const text = items[index].texts.find(Boolean);
  const sameItemDegree = items[index].texts[1];
  const sameItemDate = items[index].texts.find((value) => EDUCATION_DATE_RANGE_RE.test(value));
  const nextText = nextEducationText(items, index + 1);
  const followingText = nextEducationText(items, index + 2);

  return (
    Boolean(text) &&
    !isEducationParserNoise(text) &&
    !isEducationFieldText(text) &&
    !EDUCATION_DATE_RANGE_RE.test(text) &&
    (
      (
        Boolean(sameItemDegree) &&
        !isEducationFieldText(sameItemDegree) &&
        !EDUCATION_DATE_RANGE_RE.test(sameItemDegree) &&
        Boolean(sameItemDate)
      ) ||
      (
        Boolean(nextText) &&
        !isEducationFieldText(nextText) &&
        !EDUCATION_DATE_RANGE_RE.test(nextText) &&
        Boolean(followingText) &&
        EDUCATION_DATE_RANGE_RE.test(followingText)
      )
    )
  );
}

function nextEducationText(items, start) {
  for (let i = start; i < items.length; i++) {
    const text = items[i].texts.find((value) => value && !isEducationParserNoise(value));
    if (text) {
      return text;
    }
  }

  return null;
}

function applyEducationTexts(target, texts) {
  let inActivities = false;
  let inDescription = false;
  let descriptionContinued = false;

  for (const text of texts) {
    if (EDUCATION_DATE_RANGE_RE.test(text)) {
      target.dateRange = text;
      inActivities = false;
      inDescription = false;
      descriptionContinued = false;
      continue;
    }

    if (/^Grade:\s*/i.test(text)) {
      target.grade = clean(text.replace(/^Grade:\s*/i, ""));
      inActivities = false;
      inDescription = false;
      descriptionContinued = false;
      continue;
    }

    if (/^Activities(?: and societies)?:\s*/i.test(text)) {
      const activities = splitList(cleanActivityLabel(text.replace(/^Activities(?: and societies)?:\s*/i, "")));
      target.activities = activities.length > 0 ? activities : target.activities || [];
      inActivities = true;
      inDescription = false;
      descriptionContinued = false;
      continue;
    }

    if (inActivities && isArrowBullet(text)) {
      target.activities = [...(target.activities || []), stripArrowBullet(text)];
      continue;
    }

    if (/^(Description:|Relevant Coursework:)/i.test(text)) {
      target.description = clean(text);
      inActivities = false;
      inDescription = true;
      descriptionContinued = false;
      continue;
    }

    if (
      inDescription &&
      !descriptionContinued &&
      !isEducationFieldText(text) &&
      !EDUCATION_DATE_RANGE_RE.test(text)
    ) {
      target.description = clean(`${target.description || ""} ${text}`);
      descriptionContinued = true;
      continue;
    }

    if (target.school && !target.degree) {
      const degreeParts = splitDegree(text);
      target.degree = degreeParts.degree;
      target.fieldOfStudy = degreeParts.fieldOfStudy;
    }
  }
}

function normalizeEducationEntry(entry) {
  return {
    school: entry.school,
    degree: entry.degree,
    fieldOfStudy: entry.fieldOfStudy,
    dateRange: entry.dateRange,
    grade: entry.grade,
    activities: entry.activities || [],
    description: entry.description,
    schoolLogo: entry.schoolLogo
  };
}

function isEducationFieldText(value) {
  return /^(Grade:|Activities(?: and societies)?:|Description:|Relevant Coursework:)/i.test(value);
}

function isEducationParserNoise(value) {
  return isRscRef(value) || /^(Education|advertisement)$/i.test(value);
}

function isVisibleStructuralText(value) {
  const text = clean(value);

  return (
    Boolean(text) &&
    !isStringToken(text) &&
    !isRscRef(text) &&
    !isAnyRscRef(text) &&
    !/^https?:\/\//i.test(text) &&
    !/^urn:li:/i.test(text) &&
    !/^proto\./i.test(text) &&
    !/^[._a-z0-9-]{8,}$/i.test(text) &&
    !/^(?:className|style|children|textProps|fontFamily|fontSize|fontStyle|fontWeight|lineHeight|textAlign|renderPayload|rootUrl|suffixUrl|imageRenditions|width|height|requestMetadata|payload)$/i.test(text)
  );
}

function parseProfileCardAbout(raw) {
  if (
    !raw.includes("com.linkedin.sdui.impl.profile.components.aboutSection") &&
    !raw.includes("profile-card-about")
  ) {
    return null;
  }

  const records = extractRscRecords(raw);
  const decoded = decodeTextRecord(raw);
  const marker = '"observabilityIdentifier":"com.linkedin.sdui.impl.profile.components.aboutSection"';
  const aboutIndex = decoded.indexOf(marker);

  if (aboutIndex === -1) {
    return null;
  }

  const section = decoded.slice(aboutIndex, findAboutSectionEnd(decoded, aboutIndex + marker.length));
  if (!section.includes("profile-card-about") && !section.includes("About")) {
    return null;
  }

  const candidates = [];
  const queue = extractRscRefs(section);
  const visited = new Set();

  while (queue.length > 0) {
    const ref = queue.shift();

    if (visited.has(ref)) {
      continue;
    }

    visited.add(ref);

    const record = records[ref];
    if (!record) {
      continue;
    }

    candidates.push(...extractAboutTextProps(record));
    queue.push(...extractRscRefs(record).filter((nextRef) => !visited.has(nextRef)));
  }

  return candidates.sort((a, b) => b.length - a.length)[0] || null;
}

function extractRscRecords(raw) {
  const records = {};
  const regex = /(?:^|\n)([A-Za-z0-9]+):([\s\S]*?)(?=\n[A-Za-z0-9]+:|$)/g;
  let match;

  while ((match = regex.exec(raw))) {
    records[match[1]] = decodeTextRecord(match[2]);
  }

  return records;
}

function findAboutSectionEnd(value, start) {
  const nextSection = value.indexOf('"observabilityIdentifier":"com.linkedin.sdui.impl.profile.components.', start);

  return nextSection === -1 ? value.length : nextSection;
}

function extractRscRefs(value) {
  const refs = [];
  const regex = /"\$L?([A-Za-z0-9]+)"/g;
  let match;

  while ((match = regex.exec(value))) {
    refs.push(match[1]);
  }

  return [...new Set(refs)];
}

function extractAboutTextProps(record) {
  const texts = [];
  let start = 0;

  while (true) {
    const textPropsIndex = record.indexOf('"textProps"', start);
    if (textPropsIndex === -1) {
      break;
    }

    const objectStart = record.indexOf("{", textPropsIndex);
    if (objectStart === -1) {
      break;
    }

    const textProps = sliceBalanced(record, objectStart, "{", "}");
    start = objectStart + textProps.length;

    if (!textProps || textProps.includes('"tagName":"h2"')) {
      continue;
    }

    const children = extractPropertyValue(textProps, "children");
    const lines = extractQuotedStrings(children).filter(isAboutContentString);
    const text = normalizeAboutText(lines.join("\n"));

    if (text && text !== "About") {
      texts.push(text);
    }
  }

  return texts;
}

function extractPropertyValue(value, propertyName) {
  const propertyIndex = value.indexOf(`"${propertyName}"`);
  if (propertyIndex === -1) {
    return "";
  }

  const colonIndex = value.indexOf(":", propertyIndex);
  const valueStart = firstNonWhitespaceIndex(value, colonIndex + 1);
  const startChar = value[valueStart];

  if (startChar === "[") {
    return sliceBalanced(value, valueStart, "[", "]");
  }

  if (startChar === "{") {
    return sliceBalanced(value, valueStart, "{", "}");
  }

  if (startChar === "\"") {
    const match = /^"((?:\\.|[^"\\])*)"/.exec(value.slice(valueStart));
    return match ? match[0] : "";
  }

  return "";
}

function sliceBalanced(value, start, open, close) {
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < value.length; i++) {
    const char = value[i];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (char === "\\") {
      escaped = true;
      continue;
    }

    if (char === "\"") {
      inString = !inString;
      continue;
    }

    if (inString) {
      continue;
    }

    if (char === open) {
      depth++;
    } else if (char === close) {
      depth--;
      if (depth === 0) {
        return value.slice(start, i + 1);
      }
    }
  }

  return "";
}

function firstNonWhitespaceIndex(value, start) {
  for (let i = start; i < value.length; i++) {
    if (!/\s/.test(value[i])) {
      return i;
    }
  }

  return value.length;
}

function extractQuotedStrings(value) {
  const strings = [];
  const regex = /"((?:\\.|[^"\\])*)"/g;
  let match;

  while ((match = regex.exec(value))) {
    const text = normalizeAboutText(decode(match[1]));

    if (text) {
      strings.push(text);
    }
  }

  return strings;
}

function isAboutContentString(value) {
  return (
    value !== "$" &&
    !value.startsWith("$") &&
    !/^\d+$/.test(value) &&
    !/^text-attr-\d+$/i.test(value) &&
    !/^(?:br|span|strong|div|p|section)$/i.test(value) &&
    !/^(?:children|textProps|fontFamily|fontSize|fontStyle|fontWeight|lineHeight|textAlign|linkHoverDecoration)$/i.test(value) &&
    value !== "About"
  );
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
