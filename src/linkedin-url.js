import { AppError } from "./linkedin-client.js";

const VANITY_NAME_PATTERN = /^[A-Za-z0-9-_%]+$/;

export function extractVanityName(profileUrl) {
  let url;

  try {
    url = new URL(profileUrl);
  } catch {
    throw invalidUrl();
  }

  const hostname = url.hostname.toLowerCase();
  const isLinkedInHost = hostname === "linkedin.com" || hostname === "www.linkedin.com";
  const isSupportedProtocol = url.protocol === "http:" || url.protocol === "https:";

  if (!isLinkedInHost || !isSupportedProtocol) {
    throw invalidUrl();
  }

  const parts = url.pathname.split("/").filter(Boolean);
  if (parts.length !== 2 || parts[0] !== "in") {
    throw invalidUrl();
  }

  const vanityName = decodeURIComponent(parts[1]).trim();
  if (!vanityName || !VANITY_NAME_PATTERN.test(vanityName)) {
    throw invalidUrl();
  }

  return vanityName;
}

export function normalizeProfileUrl(vanityName) {
  return `https://www.linkedin.com/in/${encodeURIComponent(vanityName)}/`;
}

function invalidUrl() {
  return new AppError(
    "INVALID_LINKEDIN_URL",
    "A valid LinkedIn profile URL is required.",
    400
  );
}
