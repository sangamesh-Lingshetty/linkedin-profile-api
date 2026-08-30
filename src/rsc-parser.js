import { AppError } from "./linkedin-client.js";

const MONTHS = "Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec";
const EXPERIENCE_DATE_RANGE_RE = new RegExp(
  `\\b(?:${MONTHS})\\s+\\d{4}\\s+-\\s+(?:Present|(?:${MONTHS})\\s+\\d{4})\\b`,
  "i"
);
const EDUCATION_DATE_RANGE_RE = new RegExp(
  `\\b(?:(?:${MONTHS})\\s+)?\\d{4}\\s+(?:-|\\u2013|\\u2014|\\u00e2\\u20ac\\u201c|\\u00e2\\u20ac\\u0093)\\s+(?:Present|(?:(?:${MONTHS})\\s+)?\\d{4})\\b`,
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
    let insideExperience = false;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const texts = item.texts.filter((text) => !isExperienceParserNoise(text));
      const boundaryTexts = toExperienceBoundaryTexts(texts);

      if (item.texts.some((text) => /^Experience$/i.test(text))) {
        insideExperience = true;
        continue;
      }

      if (!insideExperience) {
        continue;
      }

      if (texts.length === 0) {
        continue;
      }

      if (isExperienceDescriptionItem(item)) {
        continue;
      }

      const dateIndex = texts.findIndex((text) => EXPERIENCE_DATE_RANGE_RE.test(text));

      if (isExperienceGroupParent(boundaryTexts)) {
        activeParent = parseExperienceGroupParent(boundaryTexts);
        pendingTitle = null;
        pendingCompanyLine = null;
        continue;
      }

      if (dateIndex === -1) {
        if (
          texts.length === 2 &&
          isRoleTitleCandidate(texts[0]) &&
          isCompanyEmploymentLine(texts[1])
        ) {
          pendingTitle = texts[0];
          pendingCompanyLine = texts[1];
          activeParent = null;
          continue;
        }

        if (texts.length === 1 && isRoleTitleCandidate(texts[0])) {
          if (pendingTitle && isCompanyNameCandidate(texts[0])) {
            pendingCompanyLine = texts[0];
          } else {
            pendingTitle = texts[0];
          }
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
    const flatEntries = dedupe(
      parseSequentialExperience(raw).filter(isValidExperienceEntry),
      ["title", "company", "dateRange"]
    );
    const cleanStructuralEntries = structuralEntries.filter((entry) =>
      !isSuspiciousStructuredExperience(entry, flatEntries)
    );

    return sortExperienceEntries(mergeExperienceEntries(flatEntries, cleanStructuralEntries));
  } catch {
    throw new AppError("EXTRACTION_FAILED", "LinkedIn experience extraction failed.", 502);
  }
}

export function extractExperienceSkillAssociations(raw) {
  const associations = [];
  const decoded = decodeTextRecord(raw);
  const regex = /"payload"\s*:\s*\{([\s\S]*?)\}\s*,\s*"requestMetadata"/g;
  let match;

  while ((match = regex.exec(decoded))) {
    const payload = match[1];
    const associationType = extractObjectStringValue(payload, "associationType");
    const associationId = extractObjectStringValue(payload, "associationId");
    const associationTitle = extractObjectStringValue(payload, "associationTitle");

    if (associationType === "position" && associationId && associationTitle) {
      associations.push({
        associationType,
        associationId,
        associationTitle
      });
    }
  }

  return dedupe(associations, ["associationId"]);
}

export function parseExperienceSkillAssociationDetails(raw) {
  try {
    const skills = [
      ...extractSkillNamesFromSkillComponentRefs(raw),
      ...extractSkillNamesFromAriaLabels(raw)
    ];

    return dedupeStrings(skills.filter(isAssociatedSkillName));
  } catch {
    throw new AppError(
      "EXTRACTION_FAILED",
      "LinkedIn experience skill association extraction failed.",
      502
    );
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

export function extractNextEducationStart(raw) {
  const starts = extractPaginationStarts(raw, EDUCATION_PAGER_ID);
  return starts.length > 0 ? starts[0] : null;
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
    const logoBySchool = buildEducationLogoMap(items);
    const education = [];
    let current = null;
    let pendingExtras = emptyEducationExtras();

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const texts = item.texts.filter((text) => !isEducationParserNoise(text));
      const first = texts[0];

      if (texts.length === 0) {
        continue;
      }

      if (
        (isEducationSchoolStart(items, i) || isEducationOrganizationOnlyStart(items, i, current)) &&
        canStartEducationEntry(current)
      ) {
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
          schoolLogo: logoBySchool.get(normalizeIdentity(first)) || null
        };
        applyEducationTexts(current, texts.slice(1));
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
  const regex = /(?:^|\n)([A-Za-z0-9]+):[\[{][\s\S]*?(?=(?:\n[A-Za-z0-9]+:)|$)/g;
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

    if (anchors.length > 0 && anchors.every((anchor) => !anchor.id)) {
      return parseIdlessCertificationChunks(raw, anchors);
    }

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

    return dedupeCertifications(certifications);
  } catch {
    throw new AppError("EXTRACTION_FAILED", "LinkedIn certifications extraction failed.", 502);
  }
}

function parseIdlessCertificationChunks(raw, anchors) {
  const certifications = [];

  for (let i = 0; i < anchors.length; i++) {
    const anchor = anchors[i];
    const nextAnchor = anchors[i + 1];
    const chunkStart = findCertificationChunkStart(raw, anchor.index);
    const chunkEnd = nextAnchor ? findCertificationChunkStart(raw, nextAnchor.index) : raw.length;
    const parsed = parseCertificationChunk(null, raw.slice(chunkStart, chunkEnd));

    if (parsed.name || parsed.issuingOrganization || parsed.issueDate) {
      certifications.push(parsed);
    }
  }

  return dedupeCertifications([...certifications, ...parseIdlessCertifications(raw)]);
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
    if (isCompanyEmploymentLine(texts[i].text) && !EXPERIENCE_DATE_RANGE_RE.test(texts[i].text)) {
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

  const idAnchors = anchors
    .sort((a, b) => a.index - b.index)
    .filter((anchor, index, all) => all.findIndex((item) => item.id === anchor.id) === index);

  if (idAnchors.length > 0) {
    return idAnchors;
  }

  const lockupAnchors = [];
  const lockupRegex = /license-certifications-lockup-view/g;
  let match;

  while ((match = lockupRegex.exec(raw))) {
    lockupAnchors.push({
      id: null,
      index: match.index
    });
  }

  return lockupAnchors;
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

function dedupeCertifications(certifications) {
  const seen = new Set();

  return certifications.filter((certification) => {
    const key = [
      certification.id,
      certification.name,
      certification.issuingOrganization,
      certification.issueDate
    ]
      .filter(Boolean)
      .join("|")
      .toLowerCase();

    if (!key || seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
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
  const expires = parts.find((part) => /^Expir(?:es|ed)\s+/i.test(part));

  return {
    issueDate: issued ? clean(issued.replace(/^Issued\s+/i, "")) : null,
    expirationDate: expires ? clean(expires.replace(/^Expir(?:es|ed)\s+/i, "")) : null
  };
}

function parseIdlessCertifications(raw) {
  const strings = extractSimpleText(raw)
    .map((item) => item.text)
    .filter(isCertificationTextCandidate)
    .filter((value) =>
      !isCertificationHeading(value) &&
      !isCertificationMediaName(value) &&
      !isCertificationMetadataText(value) &&
      !/^Credential ID$/i.test(value) &&
      !/^Show credential$/i.test(value) &&
      !/^Skills:?$/i.test(value)
    );
  const certifications = [];

  for (let i = 0; i < strings.length;) {
    const name = strings[i];
    const organization = strings[i + 1];
    const possibleIssueLine = strings[i + 2];
    const issueLine = /^Issued\s+/i.test(possibleIssueLine || "") ? possibleIssueLine : null;

    if (
      !name ||
      !organization ||
      /^Issued\s+/i.test(name) ||
      /^Credential ID/i.test(name) ||
      /^Issued\s+/i.test(organization) ||
      /^Credential ID/i.test(organization) ||
      certifications.some((certification) => certification.name === name)
    ) {
      i++;
      continue;
    }

    const issueParts = parseCertificationDates(issueLine);
    const next = strings[i + (issueLine ? 3 : 2)];
    const credentialId = /^Credential ID\s+/i.test(next || "")
      ? clean(next.replace(/^Credential ID\s*/i, ""))
      : null;

    certifications.push({
      id: null,
      name,
      issuingOrganization: organization,
      issueDate: issueParts.issueDate,
      expirationDate: issueParts.expirationDate,
      credentialId,
      credentialUrl: null,
      issuerLogo: null,
      media: []
    });

    i += 2 + (issueLine ? 1 : 0) + (credentialId ? 1 : 0);
  }

  return dedupeCertifications(certifications);
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

function extractObjectStringValue(raw, key) {
  const match = new RegExp(`"${key}"\\s*:\\s*"((?:\\\\.|[^"\\\\])*)"`).exec(raw);
  return clean(decode(match && match[1]));
}

function extractSkillNamesFromAriaLabels(raw) {
  const names = [];
  const rows = String(raw).split(/\r?\n/);

  for (const row of rows) {
    if (!row.includes("com.linkedin.sdui.profile.skill(")) {
      continue;
    }

    const match = /"aria-label"\s*:\s*"((?:\\.|[^"\\])*)"/.exec(row);
    const label = clean(decode(match && match[1]));
    const skill = clean(label?.replace(/^(?:Collapsed|Expanded),\s*/i, ""));

    if (skill && skill !== label) {
      names.push(skill);
    }
  }

  return names;
}

function extractSkillNamesFromSkillComponentRefs(raw) {
  const names = [];
  const rows = String(raw)
    .split(/\r?\n/)
    .filter((row) => row.includes("com.linkedin.sdui.profile.skill("));
  const textRefs = buildRscTextReferenceMap(raw);

  for (const row of rows) {
    names.push(
      ...extractSimpleText(row).map((item) => item.text),
      ...extractRscRefs(row).map((ref) => textRefs[ref])
    );
  }

  return names.filter(isAssociatedSkillName);
}

function isAssociatedSkillName(value) {
  return (
    Boolean(value) &&
    value.length > 1 &&
    value.length < 140 &&
    !isNoise(value) &&
    !isRscRef(value) &&
    !/^Learn more about these skills$/i.test(value) &&
    !/^Discover jobs, people, learning content and conversations about these skills$/i.test(value) &&
    !/^com\.linkedin\./i.test(value)
  );
}

function dedupeStrings(values) {
  const seen = new Set();
  const deduped = [];

  for (const value of values.map(clean).filter(Boolean)) {
    const key = value.toLowerCase();
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    deduped.push(value);
  }

  return deduped;
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
        value: record.value,
        image: extractLinkedInImage(record.value)
      });
      continue;
    }

    if (ownTexts.length > 0 && !compositeTextRefs.has(record.id)) {
      items.push({
        id: record.id,
        texts: ownTexts,
        value: record.value,
        image: extractLinkedInImage(record.value)
      });
      continue;
    }

    const image = extractLinkedInImage(record.value);
    if (image) {
      items.push({
        id: record.id,
        texts: [],
        value: record.value,
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

function parseSequentialExperience(raw) {
  const allTexts = extractSimpleText(raw).map((item) => item.text);
  const startIndex = allTexts.findIndex((text) => /^Experience$/i.test(text));
  const experiences = [];
  let activeParent = null;

  if (startIndex === -1) {
    return [];
  }

  const texts = allTexts.slice(startIndex + 1).filter((text) => !isExperienceParserNoise(text));

  for (let i = 0; i < texts.length; i++) {
    const text = texts[i];
    const next = texts[i + 1];
    const following = texts[i + 2];

    if (isExperienceGroupParent([text, next, following].filter(Boolean))) {
      activeParent = parseExperienceGroupParent([text, next, following].filter(Boolean));
      i += following && isLocationLine(following) ? 2 : 1;
      continue;
    }

    if (!isRoleTitleCandidate(text)) {
      continue;
    }

    if (isCompanyEmploymentLine(next) && EXPERIENCE_DATE_RANGE_RE.test(following || "")) {
      experiences.push(buildSequentialExperience(
        text,
        next,
        following,
        texts[i + 3],
        null,
        null
      ));
      activeParent = null;
      i += 2;
      continue;
    }

    if (
      isStandaloneCompanyLineCandidate(next) &&
      EXPERIENCE_DATE_RANGE_RE.test(following || "")
    ) {
      experiences.push(buildSequentialExperience(
        text,
        next,
        following,
        texts[i + 3],
        null,
        null
      ));
      activeParent = null;
      i += 2;
      continue;
    }

    if (EXPERIENCE_DATE_RANGE_RE.test(next || "")) {
      experiences.push(buildSequentialExperience(
        text,
        null,
        next,
        texts[i + 2],
        activeParent,
        null
      ));
      i += 1;
    }
  }

  return dedupe(experiences, ["title", "company", "dateRange"]);
}

function buildSequentialExperience(title, companyLine, dateLine, locationLine, activeParent, description = null) {
  const companyParts = companyLine
    ? parseCompanyEmploymentLine(companyLine) || [companyLine, null]
    : [null, null];
  const dateParts = splitOnce(dateLine);
  const locationParts = parseLocation(locationLine && isLocationLine(locationLine) ? locationLine : null);

  return {
    title,
    company: companyParts[0] || activeParent?.company || null,
    employmentType: companyParts[1] || activeParent?.employmentType || null,
    dateRange: dateParts[0],
    duration: DURATION_RE.test(dateParts[1] || "") ? dateParts[1] : extractDuration(dateLine),
    location: locationParts.location || activeParent?.location || null,
    workMode: locationParts.workMode || activeParent?.workMode || null,
    description,
    skills: []
  };
}

function mergeExperienceEntries(primaryEntries, secondaryEntries) {
  const byKey = new Map();
  const merged = [];

  for (const entry of primaryEntries) {
    const key = experienceKey(entry);
    byKey.set(key, entry);
    merged.push(entry);
  }

  for (const entry of secondaryEntries) {
    const key = experienceKey(entry);
    const existing = byKey.get(key);

    if (!existing) {
      const duplicate = findMergeableExperienceDuplicate(merged, entry);
      if (duplicate) {
        Object.assign(duplicate, mergeExperienceEntry(duplicate, entry));
        continue;
      }

      byKey.set(key, entry);
      merged.push(entry);
      continue;
    }

    Object.assign(existing, mergeExperienceEntry(existing, entry));
  }

  return merged;
}

function findMergeableExperienceDuplicate(entries, entry) {
  return entries.find((candidate) =>
    candidate.title === entry.title &&
    candidate.dateRange === entry.dateRange &&
    areSimilarCompanyNames(candidate.company, entry.company)
  );
}

function areSimilarCompanyNames(first, second) {
  const left = normalizeCompanyForComparison(first);
  const right = normalizeCompanyForComparison(second);

  return (
    left.length > 8 &&
    right.length > 8 &&
    (left.includes(right) || right.includes(left))
  );
}

function normalizeCompanyForComparison(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\bin\s+india\b/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function mergeExperienceEntry(base, incoming) {
  return {
    ...base,
    company: base.company || incoming.company,
    employmentType: base.employmentType || incoming.employmentType,
    location: base.location || incoming.location,
    workMode: base.workMode || incoming.workMode,
    description: pickExperienceDescription(base.description, incoming.description),
    skills: base.skills?.length ? base.skills : incoming.skills || []
  };
}

function pickExperienceDescription(baseDescription, incomingDescription) {
  if (!baseDescription) {
    return incomingDescription;
  }

  if (!incomingDescription) {
    return baseDescription;
  }

  return incomingDescription.length > baseDescription.length ? incomingDescription : baseDescription;
}

function experienceKey(entry) {
  return [entry.title, entry.company, entry.dateRange]
    .map((value) => String(value || "").toLowerCase())
    .join("|");
}

function sortExperienceEntries(entries) {
  return [...entries].sort((a, b) =>
    experienceEndTime(b) - experienceEndTime(a) ||
    experienceStartTime(b) - experienceStartTime(a)
  );
}

function experienceEndTime(entry) {
  const end = String(entry.dateRange || "").split(/\s+-\s+/)[1] || "";
  return /^Present$/i.test(end) ? Number.MAX_SAFE_INTEGER : parseMonthYear(end);
}

function experienceStartTime(entry) {
  const start = String(entry.dateRange || "").split(/\s+-\s+/)[0] || "";
  return parseMonthYear(start);
}

function parseMonthYear(value) {
  const match = new RegExp(`\\b(${MONTHS})\\s+(\\d{4})\\b`, "i").exec(value || "");
  if (!match) {
    return 0;
  }

  const month = MONTHS.split("|").findIndex((item) => item.toLowerCase() === match[1].toLowerCase());
  return Number(match[2]) * 12 + month;
}

function isValidExperienceEntry(entry) {
  return (
    Boolean(entry.title) &&
    Boolean(entry.dateRange) &&
    !isInvalidExperienceCompany(entry) &&
    !isEmploymentType(entry.company) &&
    !isWorkMode(entry.employmentType) &&
    !DURATION_RE.test(entry.company || "") &&
    !DURATION_RE.test(entry.employmentType || "")
  );
}

function isInvalidExperienceCompany(entry) {
  if (!entry.company || !isLocationLike(entry.company)) {
    return false;
  }

  return !entry.employmentType && !isLikelyOrganizationName(entry.company);
}

function isLikelyOrganizationName(value) {
  return /\b(?:academy|association|bank|college|company|corp|corporation|global|group|inc|institute|labs?|limited|llc|llp|ltd|office|pvt|services|solutions|systems|technologies|university)\b/i.test(value || "");
}

function isSuspiciousStructuredExperience(entry, flatEntries) {
  if (entry.description) {
    return false;
  }

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

function isSentenceLike(value) {
  return Boolean(value) && /[.!?]$/.test(value) && /\s/.test(value);
}

function isExperienceGroupParent(texts) {
  return (
    texts.length >= 2 &&
    isCompanyLineNameCandidate(texts[0]) &&
    isCompanySummaryLine(texts[1]) &&
    !isCompanyEmploymentLine(texts[1]) &&
    !texts.some((text) => EXPERIENCE_DATE_RANGE_RE.test(text)) &&
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
  const companyParts = companyLine
    ? parseCompanyEmploymentLine(companyLine) || splitOnce(companyLine)
    : [null, null];
  const childEmploymentType = texts.slice(0, dateIndex).find(isEmploymentType) || null;
  const lookaheadItems = collectExperienceLookaheadItems(items, itemIndex);
  const nonDescriptionLookaheadTexts = lookaheadItems
    .filter((item) => !isExperienceDescriptionItem(item))
    .flatMap((item) => item.texts);
  const locationText =
    texts.slice(dateIndex + 1).find(isLocationLine) ||
    nonDescriptionLookaheadTexts.find(isLocationLine) ||
    null;
  const locationParts = parseLocation(locationText);
  const skills = extractExperienceSkillsFromValues([...texts, ...nonDescriptionLookaheadTexts]);

  return {
    title,
    company: companyParts[0] || activeParent?.company || null,
    employmentType: companyParts[1] || childEmploymentType || activeParent?.employmentType || null,
    dateRange: dateParts[0],
    duration: DURATION_RE.test(dateParts[1] || "") ? dateParts[1] : extractDuration(texts[dateIndex]),
    location: locationParts.location || activeParent?.location || null,
    workMode: locationParts.workMode || activeParent?.workMode || null,
    description: extractExperienceDescriptionFromItems([items[itemIndex], ...lookaheadItems]),
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

function collectExperienceLookaheadItems(items, itemIndex) {
  const lookaheadItems = [];

  for (let i = itemIndex + 1; i < Math.min(items.length, itemIndex + 40); i++) {
    const nextItem = items[i];
    const nextTexts = nextItem.texts.filter((text) => !isExperienceParserNoise(text));

    if (isExperienceDescriptionItem(nextItem)) {
      lookaheadItems.push(nextItem);
      continue;
    }

    if (isExperienceAuxiliaryItem(nextItem)) {
      continue;
    }

    const boundaryTexts = toExperienceBoundaryTexts(nextTexts);

    if (
      boundaryTexts.some((text) => EXPERIENCE_DATE_RANGE_RE.test(text)) ||
      isExperienceGroupParent(boundaryTexts)
    ) {
      break;
    }

    lookaheadItems.push(nextItem);
  }

  return lookaheadItems;
}

function extractExperienceDescriptionFromItems(items) {
  for (const item of items) {
    const description = extractExperienceDescriptionText(item.value || "");
    if (description) {
      return description;
    }
  }

  return null;
}

function isExperienceDescriptionItem(item) {
  return Boolean(extractExperienceDescriptionText(item.value || ""));
}

function isExperienceAuxiliaryItem(item) {
  const value = item.value || "";

  return (
    value.includes("ProfileSkillAssociationDetailsScreen") ||
    value.includes("ProfilePositionDetailsEditForm") ||
    value.includes("profile_view_base_skills_associations_details")
  );
}

function extractExperienceDescriptionText(value) {
  if (!isExpandableExperienceTextBlock(value)) {
    return null;
  }

  const textPropsIndex = value.indexOf('"textProps"');
  if (textPropsIndex === -1) {
    return null;
  }

  const objectStart = value.indexOf("{", textPropsIndex);
  if (objectStart === -1) {
    return null;
  }

  const textProps = sliceBalanced(value, objectStart, "{", "}");
  const children = extractPropertyValue(textProps, "children");
  const text = normalizeExperienceDescriptionText(flattenExperienceTextChildren(children));

  return text || null;
}

function isExpandableExperienceTextBlock(value) {
  return (
    typeof value === "string" &&
    value.includes('"textProps"') &&
    (
      value.includes("expandable_text_block_auto-component") ||
      value.includes('"expansionKey"') ||
      value.includes('"bindingKey"') ||
      value.includes('"shouldCollapseNewLines":false')
    )
  );
}

function flattenExperienceTextChildren(value) {
  const parts = [];
  const regex = /"((?:\\.|[^"\\])*)"/g;
  let match;

  while ((match = regex.exec(value))) {
    const token = decode(match[1]);

    if (token === "br") {
      parts.push("\n");
      continue;
    }

    if (!isExperienceDescriptionToken(token)) {
      continue;
    }

    parts.push(token);
  }

  return parts.join("");
}

function isExperienceDescriptionToken(value) {
  const text = String(value || "");

  return (
    text.trim().length > 0 &&
    text !== "$" &&
    !text.startsWith("$") &&
    !/^\d+$/.test(text) &&
    !/^text-attr-\d+$/i.test(text) &&
    !/^(?:children|span|strong|div|p|section)$/i.test(text)
  );
}

function normalizeExperienceDescriptionText(value) {
  return value
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function extractExperienceSkillsFromValues(values) {
  const skillsText = values.find((text) => /^Skills:/i.test(text));
  if (!skillsText) {
    return [];
  }

  return splitList(skillsText.replace(/^Skills:\s*/i, ""));
}

function isCompanyEmploymentLine(value) {
  return Boolean(parseCompanyEmploymentLine(value));
}

function parseCompanyEmploymentLine(value) {
  const match = /^(.*?)\s*(?:\\u00b7|\u00b7|\u00c2\u00b7|\|)\s*(Full-time|Part-time|Contract|Internship|Freelance|Self-employed|Temporary|Apprenticeship)\b/i.exec(value || "");

  if (!match) {
    return null;
  }

  const company = clean(match[1]);
  const employmentType = clean(match[2]);

  return company && isCompanyLineNameCandidate(company) && isEmploymentType(employmentType)
    ? [company, employmentType]
    : null;
}

function isCompanyLineNameCandidate(value) {
  return (
    Boolean(value) &&
    value.length > 1 &&
    value.length < 180 &&
    !isNoise(value) &&
    !isExperienceParserNoise(value) &&
    !isEmploymentType(value) &&
    !DURATION_RE.test(value) &&
    !EXPERIENCE_DATE_RANGE_RE.test(value) &&
    !/^Skills:/i.test(value)
  );
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
    !isUiToken(value) &&
    !isLinkedInPageTitle(value) &&
    !isLongSentence(value) &&
    !isSentenceLike(value) &&
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

function isStandaloneCompanyLineCandidate(value) {
  return (
    isCompanyLineNameCandidate(value) &&
    !hasSeparator(value) &&
    !isDescriptionLikeExperienceText(value)
  );
}

function toExperienceBoundaryTexts(texts) {
  return texts.filter((text) => !isExperienceBoundaryNoise(text));
}

function isExperienceBoundaryNoise(value) {
  return (
    !value ||
    /^_/i.test(value) ||
    /^var\(--/i.test(value) ||
    /^com\.linkedin\./i.test(value) ||
    /^proto\./i.test(value) ||
    /^https?:\/\//i.test(value) ||
    /^urn:li:/i.test(value) ||
    /^(?:action|actions|children|className|componentKey|delegateComponentKey|payload|presentation|requestMetadata|screenId|style|text-attr-\d+|triggers|url|urlValue|value)$/i.test(value)
  );
}

function isExperienceParserNoise(value) {
  return (
    isRscRef(value) ||
    isUiToken(value) ||
    isLinkedInPageTitle(value) ||
    /^(Experience|Recommendation transparency|LinkedIn helped me get this job|Privacy Policy|User Agreement|Pages Terms|Cookie Policy|Copyright Policy)$/i.test(value)
  );
}

function isDescriptionLikeExperienceText(value) {
  const text = String(value || "").trim();

  return (
    /^(?:[-*•]|\u2022|\u00e2\u0080\u00a2)\s*/.test(text) ||
    (text.length > 90 && /[.!?]/.test(text)) ||
    (text.split(/\s+/).length > 14 && /[.!?]/.test(text))
  );
}

function isUiToken(value) {
  return /^(ToastDuration_UNKNOWN|topStart|bottomStart)$/i.test(value || "");
}

function isLinkedInPageTitle(value) {
  return /\|\s*LinkedIn$/i.test(value || "");
}

function isLocationLine(value) {
  return (
    Boolean(value) &&
    !isDescriptionLikeExperienceText(value) &&
    (isLocationLike(value) || value.split(SEPARATOR_RE).some(isWorkMode))
  );
}

function isLocationLike(value) {
  return (
    Boolean(value) &&
    (
      isWorkMode(value) ||
      /,\s*[A-Za-z]/.test(value) ||
      /\bsector\s+\d+[A-Za-z-]*\b/i.test(value) ||
      /\b(?:Remote|On-site|Onsite|Hybrid|Area|Bengaluru|Bangalore|India|Karnataka|Mysore|Road)\b/i.test(value)
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

function canStartEducationEntry(current) {
  return !current || Boolean(current.dateRange);
}

function buildEducationLogoMap(items) {
  const logos = new Map();

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const logoLabel = item.texts
      .map(clean)
      .filter(Boolean)
      .find((text) => / logo$/i.test(text));

    if (!logoLabel) {
      continue;
    }

    const school = clean(logoLabel.replace(/\s+logo$/i, ""));
    const image = item.image;

    if (school && image) {
      logos.set(normalizeIdentity(school), image);
    }
  }

  return logos;
}

function normalizeIdentity(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function isEducationSchoolStart(items, index) {
  if (index < 0 || index >= items.length) {
    return false;
  }

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
        Boolean(sameItemDate) &&
        !sameItemDegree
      ) ||
      (
        Boolean(nextText) &&
        EDUCATION_DATE_RANGE_RE.test(nextText)
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

function isEducationOrganizationOnlyStart(items, index, current) {
  if (!current?.dateRange) {
    return false;
  }

  const texts = items[index].texts.filter((value) => value && !isEducationParserNoise(value));
  const text = texts[0];

  return (
    texts.length === 1 &&
    Boolean(text) &&
    !isEducationFieldText(text) &&
    !EDUCATION_DATE_RANGE_RE.test(text) &&
    isEducationOrganizationName(text)
  );
}

function isEducationOrganizationName(value) {
  return /\b(?:university|college|school|institute|academy|polytechnic|vidyalaya|iit|iim)\b/i.test(value || "");
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

    if (target.school && !target.degree && !isCssLikeText(text)) {
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
  return (
    isRscRef(value) ||
    isStringToken(value) ||
    isCssLikeText(value) ||
    /^_/i.test(value) ||
    /^var\(--/i.test(value) ||
    / logo$/i.test(value) ||
    /^(Education|advertisement|figure|imageId|low|xMidYMid slice)$/i.test(value)
  );
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

function isCssLikeText(value) {
  const text = String(value || "").trim();

  return (
    /^var\(--/i.test(text) ||
    /^_/i.test(text) ||
    /^[a-f0-9]{6,}\s+_[a-f0-9]{6,}(?:\s+_?[a-f0-9]{6,})*$/i.test(text) ||
    /^(?:display|inline|block|flex|grid|absolute|relative|static|sticky|fixed|hidden)$/i.test(text) ||
    /^(?:text|font|leading|tracking|line|color|bg|border|rounded|margin|padding|px|py|mx|my)-/i.test(text)
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
    (value.length > 1 || /^[A-Za-z]$/.test(value)) &&
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
    !isCertificationMetadataText(value) &&
    !isSerializationFragment(value) &&
    !/^[\[\]{}(),:]+$/.test(value) &&
    !/^Edit\s+/i.test(value) &&
    !/^license-certifications-/i.test(value) &&
    !/^com\.linkedin\./i.test(value) &&
    !/^https?:\/\//i.test(value) &&
    !/^(url|urlValue|payload|certificationId|profileId|children|renderPayload|imageRenditions|rootUrl|suffixUrl|width|height)$/i.test(value)
  );
}

function isCertificationMetadataText(value) {
  return /\bCourse Certificate$/i.test(value || "");
}

function isSerializationFragment(value) {
  const text = String(value || "").trim();

  return (
    /^[\s,[\]{}:"']*(?:null|undefined|true|false)?[\s,[\]{}:"']*$/i.test(text) ||
    /^,?\s*(?:null|undefined|true|false)\s*,?\s*\{?$/i.test(text) ||
    /^[\]}\[{,].*[\]}]?$/.test(text)
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
