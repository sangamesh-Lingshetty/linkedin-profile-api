const LINKEDIN_BASE_URL = "https://www.linkedin.com";

export class AppError extends Error {
  constructor(code, message, statusCode = 500, linkedinStatus) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.statusCode = statusCode;
    this.linkedinStatus = linkedinStatus;
  }
}

export async function linkedinRequest({
  path,
  method = "POST",
  body,
  referer,
  headers = {},
  timeoutMs = 15000
}) {
  const cookie = process.env.LINKEDIN_COOKIE;
  const csrfToken = process.env.LINKEDIN_CSRF_TOKEN;

  if (!cookie || !csrfToken) {
    throw new AppError(
      "LINKEDIN_AUTH_FAILED",
      "LinkedIn cookie and CSRF token are required.",
      401
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = Date.now();

  try {
    const requestHeaders = {
      accept: "*/*",
      "accept-language": "en-US,en;q=0.9",
      "content-type": "application/json",
      cookie,
      "csrf-token": csrfToken,
      origin: LINKEDIN_BASE_URL,
      referer: referer || LINKEDIN_BASE_URL,
      "x-li-lang": "en_US",
      "x-li-track": JSON.stringify({ clientVersion: "1.13.30688", mpName: "voyager-web" }),
      "x-restli-protocol-version": "2.0.0",
      ...headers
    };

    for (const [name, value] of Object.entries(requestHeaders)) {
      if (value === undefined || value === null) {
        delete requestHeaders[name];
      }
    }

    const response = await fetch(new URL(path, LINKEDIN_BASE_URL), {
      method,
      signal: controller.signal,
      headers: requestHeaders,
      body: body === undefined ? undefined : JSON.stringify(body),
      redirect: "manual"
    });

    const text = await response.text();
    const durationMs = Date.now() - startedAt;
    const contentType = response.headers.get("content-type");
    const location = response.headers.get("location");

    console.log({
      status: response.status,
      contentType,
      durationMs
    });

    if (isAuthRedirect(response.status, location) || isLoginPlainTextResponse(contentType, location, text)) {
      throw new AppError(
        "LINKEDIN_AUTH_FAILED",
        "LinkedIn session is invalid or expired.",
        401,
        response.status
      );
    }

    if (isUnexpectedRedirect(response.status)) {
      throw new AppError(
        "LINKEDIN_REQUEST_FAILED",
        "LinkedIn redirected the request instead of returning profile data.",
        502,
        response.status
      );
    }

    if (!response.ok) {
      throw linkedInError(response.status);
    }

    return {
      text,
      status: response.status,
      durationMs,
      contentType
    };
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    if (error.name === "AbortError") {
      throw new AppError("LINKEDIN_REQUEST_FAILED", "LinkedIn request timed out.", 502);
    }

    throw new AppError("LINKEDIN_REQUEST_FAILED", "LinkedIn request failed.", 502);
  } finally {
    clearTimeout(timeout);
  }
}

function isAuthRedirect(status, location) {
  return isRedirectStatus(status) && /\/(?:uas\/login|login|authwall|checkpoint)\b/i.test(location || "");
}

function isLoginPlainTextResponse(contentType, location, text) {
  return (
    /^text\/plain\b/i.test(contentType || "") &&
    /\/(?:uas\/login|login|authwall|checkpoint)\b/i.test(location || "") &&
    text.length === 0
  );
}

function isUnexpectedRedirect(status) {
  return isRedirectStatus(status);
}

function isRedirectStatus(status) {
  return [301, 302, 303, 307, 308].includes(status);
}

function linkedInError(status) {
  if (status === 401) {
    return new AppError(
      "LINKEDIN_AUTH_FAILED",
      "LinkedIn session is invalid or expired.",
      401,
      status
    );
  }

  if (status === 403) {
    return new AppError(
      "LINKEDIN_FORBIDDEN",
      "LinkedIn rejected the request.",
      403,
      status
    );
  }

  if (status === 429) {
    return new AppError(
      "LINKEDIN_RATE_LIMITED",
      "LinkedIn rate limited the request.",
      502,
      status
    );
  }

  return new AppError(
    "LINKEDIN_REQUEST_FAILED",
    `LinkedIn request failed with status ${status}.`,
    502,
    status
  );
}
