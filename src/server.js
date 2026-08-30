import "dotenv/config";
import crypto from "node:crypto";
import { pathToFileURL } from "node:url";
import express from "express";
import { getAbout } from "./about.js";
import { getBasicProfile } from "./basic-profile.js";
import { getCertifications } from "./certifications.js";
import { getEducation } from "./education.js";
import { getExperience } from "./experience.js";
import { getLanguages } from "./languages.js";
import { getSkills } from "./skills.js";
import { AppError } from "./linkedin-client.js";
import { extractVanityName, normalizeProfileUrl } from "./linkedin-url.js";

const app = express();

app.use(express.json({ limit: "64kb" }));

app.use((req, res, next) => {
  req.id = req.get("x-request-id") || crypto.randomUUID();
  next();
});

app.get("/health", (req, res) => {
  res.json({ ok: true });
});

app.post("/api/profile", async (req, res) => {
  const startedAt = Date.now();
  let vanityName;

  try {
    if (!req.body || typeof req.body.profileUrl !== "string") {
      throw invalidUrl();
    }

    vanityName = extractVanityName(req.body.profileUrl);
    const [basicProfileSection, aboutSection, experienceSection, educationSection, skillsSection, certificationsSection, languagesSection] = await Promise.all([
      safeSection(req, "profile", () => getBasicProfile(vanityName), emptyBasicProfile()),
      safeSection(req, "about", () => getAbout(vanityName), null),
      safeSection(req, "experience", () => getExperience(vanityName), []),
      safeSection(req, "education", () => getEducation(vanityName), []),
      safeSection(req, "skills", () => getSkills(vanityName), []),
      safeSection(req, "certifications", () => getCertifications(vanityName), []),
      safeSection(req, "languages", () => getLanguages(vanityName), [])
    ]);
    const basicProfile = basicProfileSection.value;
    const warnings = [
      ...basicProfileSection.warnings,
      ...aboutSection.warnings,
      ...experienceSection.warnings,
      ...educationSection.warnings,
      ...skillsSection.warnings,
      ...certificationsSection.warnings,
      ...languagesSection.warnings
    ];

    console.info({
      requestId: req.id,
      vanityName,
      profileLinkedinStatus: basicProfileSection.linkedinStatus,
      aboutLinkedinStatus: aboutSection.linkedinStatus,
      experienceLinkedinStatus: experienceSection.linkedinStatus,
      educationLinkedinStatus: educationSection.linkedinStatus,
      skillsLinkedinStatus: skillsSection.linkedinStatus,
      certificationsLinkedinStatus: certificationsSection.linkedinStatus,
      durationMs:
        basicProfileSection.durationMs +
        aboutSection.durationMs +
        experienceSection.durationMs +
        educationSection.durationMs +
        skillsSection.durationMs +
        certificationsSection.durationMs +
        languagesSection.durationMs,
      profileFound: Boolean(basicProfile.name),
      aboutFound: Boolean(aboutSection.value),
      experienceCount: experienceSection.value.length,
      educationCount: educationSection.value.length,
      skillsCount: skillsSection.value.length,
      certificationsCount: certificationsSection.value.length,
      languagesCount: languagesSection.value.length,
      warnings
    });

    res.json({
      profileUrl: normalizeProfileUrl(vanityName),
      vanityName,
      profile: {
        name: basicProfile.name,
        headline: basicProfile.headline,
        location: basicProfile.location,
        pronouns: basicProfile.pronouns
      },
      images: {
        profile: basicProfile.profileImage,
        background: basicProfile.backgroundImage
      },
      about: aboutSection.value,
      experience: experienceSection.value,
      education: educationSection.value,
      skills: skillsSection.value,
      certifications: certificationsSection.value,
      languages: languagesSection.value,
      meta: {
        source: "linkedin",
        partial: warnings.length > 0,
        warnings
      }
    });
  } catch (error) {
    const appError = toAppError(error);

    console.warn({
      requestId: req.id,
      vanityName,
      linkedinStatus: appError.linkedinStatus,
      durationMs: Date.now() - startedAt,
      errorCode: appError.code
    });

    res.status(routeStatus(appError)).json({
      error: {
        code: routeCode(appError),
        message: routeMessage(appError)
      }
    });
  }
});

app.use((error, req, res, next) => {
  if (error instanceof SyntaxError) {
    return res.status(400).json({
      error: {
        code: "INVALID_LINKEDIN_URL",
        message: "A valid LinkedIn profile URL is required."
      }
    });
  }

  next(error);
});

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.PORT || 3000);
  const host = process.env.HOST || "0.0.0.0";

  app.listen(port, host, () => {
    console.info({ message: "Server listening", host, port });
  });
}

export default app;
export { app };

function invalidUrl() {
  return new AppError(
    "INVALID_LINKEDIN_URL",
    "A valid LinkedIn profile URL is required.",
    400
  );
}

function emptyBasicProfile() {
  return {
    name: null,
    headline: null,
    location: null,
    pronouns: null,
    profileImage: null,
    backgroundImage: null
  };
}

async function safeSection(req, section, load, fallback) {
  try {
    const result = await load();

    return {
      value: Object.hasOwn(result, "entries") ? result.entries : result.value,
      linkedinStatus: result.linkedinStatus,
      durationMs: result.durationMs || 0,
      warnings: []
    };
  } catch (error) {
    if (isAuthError(error)) {
      throw error;
    }

    console.warn("[linkedin-section-failed]", {
      requestId: req.id,
      section,
      code: error.code,
      linkedinStatus: error.linkedinStatus
    });

    return {
      value: fallback,
      linkedinStatus: error.linkedinStatus,
      durationMs: 0,
      warnings: [`${section} section unavailable`]
    };
  }
}

function isAuthError(error) {
  return error instanceof AppError &&
    (error.code === "LINKEDIN_AUTH_FAILED" || error.code === "LINKEDIN_FORBIDDEN");
}

function toAppError(error) {
  if (error instanceof AppError) {
    return error;
  }

  return new AppError("LINKEDIN_REQUEST_FAILED", "The request failed.", 502);
}

function routeStatus(error) {
  if (error.code === "LINKEDIN_FORBIDDEN") {
    return 403;
  }

  return error.statusCode;
}

function routeCode(error) {
  if (error.code === "LINKEDIN_FORBIDDEN") {
    return "LINKEDIN_AUTH_FAILED";
  }

  return error.code;
}

function routeMessage(error) {
  if (error.code === "INVALID_LINKEDIN_URL") {
    return "A valid LinkedIn profile URL is required.";
  }

  if (error.code === "LINKEDIN_AUTH_FAILED" || error.code === "LINKEDIN_FORBIDDEN") {
    return "LinkedIn session is invalid or expired.";
  }

  return error.message;
}
