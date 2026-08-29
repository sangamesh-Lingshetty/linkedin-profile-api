import { linkedinRequest } from "./linkedin-client.js";

export async function getBasicProfile(vanityName) {
  const response = await linkedinRequest({
    path: `/in/${encodeURIComponent(vanityName)}/`,
    method: "GET",
    referer: "https://www.linkedin.com/",
    headers: {
      "content-type": undefined,
      origin: undefined
    }
  });

  return {
    value: parseBasicProfilePage(response.text, vanityName),
    linkedinStatus: response.status,
    durationMs: response.durationMs
  };
}

export async function checkBasicProfilePage(vanityName, expected = {}) {
  const response = await linkedinRequest({
    path: `/in/${encodeURIComponent(vanityName)}/`,
    method: "GET",
    referer: "https://www.linkedin.com/",
    headers: {
      "content-type": undefined,
      origin: undefined
    }
  });

  return {
    status: response.status,
    contentType: response.contentType,
    responseLength: response.text.length,
    hasTargetName: expected.name ? response.text.includes(expected.name) : false,
    hasAbout: expected.about ? response.text.includes(expected.about) : false,
    hasProfileImage: response.text.includes("profile-displayphoto"),
    hasBackgroundImage: response.text.includes("profile-displaybackgroundimage")
  };
}

export function parseBasicProfilePage(raw, vanityName) {
  const topCardTexts = extractTopCardTexts(raw, vanityName);
  const name = topCardTexts.find((item) => item.tag === "h2")?.text || extractNameFromTitle(raw);
  const plainTexts = topCardTexts.map((item) => item.text);
  const nameIndex = plainTexts.findIndex((text) => text === name);
  const contactIndex = plainTexts.findIndex((text) => /^Contact info$/i.test(text));
  const afterName = plainTexts.slice(nameIndex + 1, contactIndex === -1 ? undefined : contactIndex);
  const pronouns = afterName.find(isPronouns) || null;
  const location = extractLocation(plainTexts, contactIndex);
  const headline = afterName.find((text) =>
    text !== pronouns &&
    text !== location &&
    !isTopCardNoise(text) &&
    !isCompanySchoolLine(text)
  ) || null;

  return {
    name,
    headline,
    location,
    pronouns,
    about: extractAboutFromProfilePage(raw, vanityName),
    profileImage: extractLargestImage(raw, "profile-displayphoto"),
    backgroundImage: extractLargestImage(raw, "profile-displaybackgroundimage"),
    isSelfProfile: isSelfProfilePage(raw)
  };
}

export function extractAboutFromProfilePage(raw, vanityName) {
  return (
    extractAboutFromRenderedSection(raw, vanityName) ||
    extractAboutFromSerializedSection(raw, vanityName)
  );
}

function extractTopCardTexts(raw, vanityName) {
  const contactNeedle = `/in/${vanityName}/overlay/contact-info/`;
  const contactIndex = raw.indexOf(contactNeedle);
  const endIndex = contactIndex === -1 ? raw.indexOf("</main>") : contactIndex + 1000;
  const h2Index = raw.lastIndexOf("<h2", contactIndex === -1 ? raw.indexOf("</main>") : contactIndex);
  const startIndex = h2Index === -1 ? 0 : h2Index;
  const region = raw.slice(startIndex, endIndex === -1 ? raw.length : endIndex);
  const texts = [];
  const regex = /<(h2|p|span|a)\b[^>]*>([\s\S]*?)<\/\1>/gi;
  let match;

  while ((match = regex.exec(region))) {
    const text = cleanText(stripTags(match[2]));

    if (text) {
      texts.push({
        tag: match[1].toLowerCase(),
        text
      });
    }
  }

  return texts;
}

function extractNameFromTitle(raw) {
  const match = /<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(raw);
  const title = cleanText(stripTags(match && match[1]));

  return title ? cleanText(title.replace(/\s*\|\s*LinkedIn$/i, "")) : null;
}

function extractLocation(texts, contactIndex) {
  const end = contactIndex === -1 ? texts.length : contactIndex;

  for (let i = end - 1; i >= 0; i--) {
    const text = texts[i];

    if (!isTopCardNoise(text) && !isCompanySchoolLine(text) && !isPronouns(text)) {
      return text;
    }
  }

  return null;
}

function extractAboutFromRenderedSection(raw, vanityName) {
  const main = sliceBetween(raw, "<main", "</main>") || raw;
  const sections = main.match(/<section\b[\s\S]*?<\/section>/gi) || [];

  for (const section of sections) {
    if (!isRequestedProfileSection(section, vanityName) || !hasAboutHeading(section)) {
      continue;
    }

    const about = aboutTextAfterHeading(extractHtmlTexts(section));

    if (about) {
      return about;
    }
  }

  return null;
}

function extractAboutFromSerializedSection(raw, vanityName) {
  const decoded = decodeEscapedJson(decodeHtml(raw));
  const anchors = [
    `${vanityName}_about`,
    `${vanityName}About`,
    `ref${vanityName}About`
  ];

  for (const anchor of anchors) {
    let start = 0;

    while (true) {
      const index = decoded.indexOf(anchor, start);

      if (index === -1) {
        break;
      }

      const region = decoded.slice(index, Math.min(decoded.length, index + 9000));

      if (isFooterOrVerificationRegion(region) || !hasSerializedAboutHeading(region)) {
        start = index + anchor.length;
        continue;
      }

      const about = aboutTextAfterHeading(extractSerializedTexts(region));

      if (about) {
        return about;
      }

      start = index + anchor.length;
    }
  }

  return null;
}

function extractLargestImage(raw, marker) {
  const srcsets = extractImageSrcSets(raw, marker);
  const candidates = srcsets.flatMap(parseSrcSet);
  const largest = candidates
    .filter((candidate) => candidate.url.includes(marker))
    .sort((a, b) => b.width - a.width)[0];

  if (largest) {
    return largest.url;
  }

  const urls = [...raw.matchAll(/https?:\/\/[^"'\s<>]+/g)]
    .map((match) => decodeHtml(match[0]))
    .filter((url) => url.includes(marker));

  return urls.sort((a, b) => imageWidthFromUrl(b) - imageWidthFromUrl(a))[0] || null;
}

function extractImageSrcSets(raw, marker) {
  const srcsets = [];
  const regex = /\b(?:imageSrcSet|srcset)="([^"]+)"/gi;
  let match;

  while ((match = regex.exec(raw))) {
    const srcset = decodeHtml(match[1]);

    if (srcset.includes(marker)) {
      srcsets.push(srcset);
    }
  }

  return srcsets;
}

function parseSrcSet(srcset) {
  return srcset
    .split(/\s*,\s*/)
    .map((candidate) => {
      const match = /^(https?:\/\/\S+)\s+(\d+)w$/.exec(candidate.trim());

      return match
        ? {
            url: decodeHtml(match[1]),
            width: Number(match[2])
          }
        : null;
    })
    .filter(Boolean);
}

function imageWidthFromUrl(url) {
  const match = /(?:scale|crop|shrink)_(\d+)_/i.exec(url);

  return match ? Number(match[1]) : 0;
}

function isPronouns(value) {
  return /^(?:he|him|his|she|her|hers|they|them|their|theirs|ze|zir|xe|xem)(?:\s*\/\s*(?:he|him|his|she|her|hers|they|them|their|theirs|ze|zir|xe|xem))+$/i.test(value);
}

function isTopCardNoise(value) {
  return (
    value === "·" ||
    /^·\s*(?:1st|2nd|3rd|\d+\+?)$/i.test(value) ||
    /^Contact info$/i.test(value)
  );
}

function isCompanySchoolLine(value) {
  return /\s·\s/.test(value);
}

function isRequestedProfileSection(section, vanityName) {
  return (
    section.includes(`/in/${vanityName}`) ||
    section.includes(`${vanityName}_about`) ||
    section.includes(`${vanityName}About`) ||
    !section.includes("about.linkedin.com")
  );
}

function hasAboutHeading(value) {
  return /<h[2-3]\b[^>]*>\s*About\s*<\/h[2-3]>/i.test(value);
}

function hasSerializedAboutHeading(value) {
  return (
    value.includes(`"children":["About"]`) ||
    value.includes(`"children":"About"`)
  );
}

function isFooterOrVerificationRegion(value) {
  return (
    value.includes("about.linkedin.com") ||
    value.includes("profile-about-this-profile") ||
    value.includes("About this member") ||
    value.includes("Recommendation transparency")
  );
}

function aboutTextAfterHeading(texts) {
  const headingIndex = texts.findIndex((text) => /^About$/i.test(text));

  if (headingIndex === -1) {
    return null;
  }

  const parts = [];

  for (const text of texts.slice(headingIndex + 1)) {
    if (isNextProfileSectionHeading(text) || isAboutNoise(text)) {
      if (parts.length > 0) {
        break;
      }

      continue;
    }

    if (!hasUnresolvedReference(text)) {
      parts.push(text);
    }
  }

  return cleanAbout(parts.join("\n"));
}

function extractHtmlTexts(value) {
  const texts = [];
  const regex = /<(h2|h3|p|span|div)\b[^>]*>([\s\S]*?)<\/\1>/gi;
  let match;

  while ((match = regex.exec(value))) {
    const text = cleanText(stripTags(match[2]));

    if (text) {
      texts.push(text);
    }
  }

  return texts;
}

function extractSerializedTexts(value) {
  const texts = [];
  const regexes = [
    /"children"\s*:\s*\[\s*"((?:\\.|[^"\\])*)"\s*\]/g,
    /"children"\s*:\s*"((?:\\.|[^"\\])*)"/g,
    /"text"\s*:\s*"((?:\\.|[^"\\])*)"/g
  ];

  for (const regex of regexes) {
    let match;

    while ((match = regex.exec(value))) {
      const text = cleanText(decodeJsonString(match[1]));

      if (text) {
        texts.push(text);
      }
    }
  }

  return texts.filter((text, index, all) => all.indexOf(text) === index);
}

function isNextProfileSectionHeading(value) {
  return /^(?:Activity|Experience|Education|Licenses & certifications|Skills|Recommendations|Interests|Courses|Projects|Languages|Organizations)$/i.test(value);
}

function isAboutNoise(value) {
  return /^(?:Show all|See more|See less|Edit about|Add about|Contact info)$/i.test(value);
}

function hasUnresolvedReference(value) {
  return /^\$L?[a-zA-Z0-9]+$/.test(value) || value.includes("$undefined") || value.includes("\":[");
}

function cleanAbout(value) {
  const text = String(value || "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return text || null;
}

function sliceBetween(value, startNeedle, endNeedle) {
  const start = value.indexOf(startNeedle);

  if (start === -1) {
    return null;
  }

  const end = value.indexOf(endNeedle, start);

  return end === -1 ? value.slice(start) : value.slice(start, end + endNeedle.length);
}

function stripTags(value) {
  return String(value || "").replace(/<[^>]+>/g, "");
}

function cleanText(value) {
  const text = decodeHtml(value).replace(/\s+/g, " ").trim();

  return text || null;
}

function decodeHtml(value) {
  return String(value || "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, code) => String.fromCharCode(Number.parseInt(code, 16)));
}

function decodeEscapedJson(value) {
  return String(value || "")
    .replace(/\\"/g, "\"")
    .replace(/\\n/g, "\n")
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, code) => String.fromCharCode(Number.parseInt(code, 16)));
}

function decodeJsonString(value) {
  try {
    return JSON.parse(`"${value}"`);
  } catch {
    return value;
  }
}

function isSelfProfilePage(raw) {
  return raw.includes("com.linkedin.sdui.flagshipnav.profile.ProfileEditIntroForm");
}
