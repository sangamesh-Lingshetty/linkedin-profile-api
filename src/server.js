import "dotenv/config";
import crypto from "node:crypto";
import express from "express";
import { getExperience } from "./experience.js";
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
    const result = await getExperience(vanityName);

    console.info({
      requestId: req.id,
      vanityName,
      linkedinStatus: result.linkedinStatus,
      durationMs: result.durationMs,
      extractionCount: result.entries.length
    });

    res.json({
      profileUrl: normalizeProfileUrl(vanityName),
      vanityName,
      experience: result.entries,
      meta: {
        source: "linkedin",
        partial: true
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

const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || "0.0.0.0";

app.listen(port, host, () => {
  console.info({ message: "Server listening", host, port });
});

function invalidUrl() {
  return new AppError(
    "INVALID_LINKEDIN_URL",
    "A valid LinkedIn profile URL is required.",
    400
  );
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
