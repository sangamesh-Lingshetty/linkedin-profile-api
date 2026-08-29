import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import http from "node:http";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { app } from "../src/server.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

test("About 404 does not fail the whole profile response", async (t) => {
  const originalFetch = global.fetch;
  const originalCookie = process.env.LINKEDIN_COOKIE;
  const originalCsrf = process.env.LINKEDIN_CSRF_TOKEN;

  process.env.LINKEDIN_COOKIE = "dummy-cookie";
  process.env.LINKEDIN_CSRF_TOKEN = "dummy-csrf";

  global.fetch = async (url, options) => {
    const requestUrl = String(url);

    if (requestUrl.includes("/in/example/") && !requestUrl.includes("/details/")) {
      return new Response(`
        <html>
          <head>
            <title>Example Person | LinkedIn</title>
            <link rel="preload" as="image" imageSrcSet="https://media.licdn.com/dms/image/profile-displaybackgroundimage-shrink_350_1400/bg 1400w"/>
            <link rel="preload" as="image" imageSrcSet="https://media.licdn.com/dms/image/profile-displayphoto-crop_800_800/photo 800w"/>
          </head>
          <body>
            <main>
              <h2>Example Person</h2>
              <p>He/Him</p>
              <p>Example Headline</p>
              <p>Example City</p>
              <p>·</p>
              <p><a href="https://www.linkedin.com/in/example/overlay/contact-info/">Contact info</a></p>
            </main>
          </body>
        </html>
      `, {
        status: 200,
        headers: {
          "content-type": "text/html"
        }
      });
    }

    if (requestUrl.includes("/rsc-action/actions/component") && requestUrl.includes("profileCardsAboveActivity")) {
      return new Response("Not found", { status: 404 });
    }

    if (requestUrl.includes("/details/experience/")) {
      return rscResponse(readFixture("experience-rsc.txt"));
    }

    if (requestUrl.includes("/details/education/")) {
      return rscResponse(readFixture("education-screen-rsc.txt"));
    }

    if (requestUrl.includes("pagers.profile.details.education")) {
      return rscResponse(readFixture("education-pagination-rsc.txt"));
    }

    if (requestUrl.includes("/details/skills/")) {
      return rscResponse(readFixture("skills-screen-rsc.txt"));
    }

    if (requestUrl.includes("pagers.profile.details.skills")) {
      return rscResponse(readFixture("skills-pagination-page-2-rsc.txt"));
    }

    if (requestUrl.includes("/details/certifications/")) {
      return new Response("Not found", { status: 404 });
    }

    throw new Error(`Unexpected LinkedIn request: ${requestUrl} ${options?.body || ""}`);
  };

  const server = app.listen(0);

  t.after(() => {
    server.close();
    global.fetch = originalFetch;
    restoreEnv("LINKEDIN_COOKIE", originalCookie);
    restoreEnv("LINKEDIN_CSRF_TOKEN", originalCsrf);
  });

  const response = await postJson(server, "/api/profile", {
    profileUrl: "https://www.linkedin.com/in/example/"
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body.profile, {
    name: "Example Person",
    headline: "Example Headline",
    location: "Example City",
    pronouns: "He/Him"
  });
  assert.deepEqual(response.body.images, {
    profile: "https://media.licdn.com/dms/image/profile-displayphoto-crop_800_800/photo",
    background: "https://media.licdn.com/dms/image/profile-displaybackgroundimage-shrink_350_1400/bg"
  });
  assert.equal(response.body.about, null);
  assert.equal(Array.isArray(response.body.experience), true);
  assert.equal(Array.isArray(response.body.education), true);
  assert.equal(Array.isArray(response.body.skills), true);
  assert.deepEqual(response.body.certifications, []);
  assert.deepEqual(response.body.languages, []);
  assert.deepEqual(response.body.meta.warnings, ["about section unavailable"]);
});

test("profile response includes About from the read-only profile component", async (t) => {
  const originalFetch = global.fetch;
  const originalCookie = process.env.LINKEDIN_COOKIE;
  const originalCsrf = process.env.LINKEDIN_CSRF_TOKEN;

  process.env.LINKEDIN_COOKIE = "dummy-cookie";
  process.env.LINKEDIN_CSRF_TOKEN = "dummy-csrf";

  global.fetch = async (url) => {
    const requestUrl = String(url);

    if (requestUrl.includes("/in/example/") && !requestUrl.includes("/details/")) {
      return new Response(`
        <html>
          <head>
            <title>Example Person | LinkedIn</title>
            <link rel="preload" as="image" imageSrcSet="https://media.licdn.com/dms/image/profile-displaybackgroundimage-shrink_350_1400/bg 1400w"/>
            <link rel="preload" as="image" imageSrcSet="https://media.licdn.com/dms/image/profile-displayphoto-crop_800_800/photo 800w"/>
          </head>
          <body>
            <main>
              <h2>Example Person</h2>
              <p>Example Headline</p>
              <p>Example City</p>
              <p><a href="https://www.linkedin.com/in/example/overlay/contact-info/">Contact info</a></p>
            </main>
          </body>
        </html>
      `, {
        status: 200,
        headers: {
          "content-type": "text/html"
        }
      });
    }

    if (requestUrl.includes("/rsc-action/actions/component") && requestUrl.includes("profileCardsAboveActivity")) {
      return rscResponse(componentAboutFixture("Backend / Full Stack Engineer building reliable APIs."));
    }

    if (requestUrl.includes("/details/experience/")) {
      return rscResponse(readFixture("experience-rsc.txt"));
    }

    if (requestUrl.includes("/details/education/")) {
      return rscResponse(readFixture("education-screen-rsc.txt"));
    }

    if (requestUrl.includes("pagers.profile.details.education")) {
      return rscResponse(readFixture("education-pagination-rsc.txt"));
    }

    if (requestUrl.includes("/details/skills/")) {
      return rscResponse(readFixture("skills-screen-rsc.txt"));
    }

    if (requestUrl.includes("pagers.profile.details.skills")) {
      return rscResponse(readFixture("skills-pagination-page-2-rsc.txt"));
    }

    if (requestUrl.includes("/details/certifications/")) {
      return new Response("Not found", { status: 404 });
    }

    throw new Error(`Unexpected LinkedIn request: ${requestUrl}`);
  };

  const server = app.listen(0);

  t.after(() => {
    server.close();
    global.fetch = originalFetch;
    restoreEnv("LINKEDIN_COOKIE", originalCookie);
    restoreEnv("LINKEDIN_CSRF_TOKEN", originalCsrf);
  });

  const response = await postJson(server, "/api/profile", {
    profileUrl: "https://www.linkedin.com/in/example/"
  });

  assert.equal(response.statusCode, 200);
  assert.match(response.body.about, /Backend \/ Full Stack Engineer/);
  assert.deepEqual(response.body.meta.warnings, []);
});

function readFixture(fileName) {
  return readFileSync(join(__dirname, "fixtures", fileName), "utf8");
}

function rscResponse(body) {
  return new Response(body, {
    status: 200,
    headers: {
      "content-type": "text/x-component"
    }
  });
}

function componentAboutFixture(text) {
  return [
    '0:["$","$L3",null,{"observabilityIdentifier":"com.linkedin.sdui.impl.profile.components.aboutSection","children":["$","$L4",null,{"componentKey":"com.linkedin.sdui.profile.card.refexampleAbout","children":["$","$L5","com.linkedin.sdui.profile.card.refexampleAbout",{"initialContent":"$L7"}]}]}]',
    '7:["$","$L4",null,{"componentKey":"com.linkedin.sdui.profile.card.refexampleAbout","viewTrackingSpecs":{"viewName":"profile-card-about"},"children":["$","section",null,{"componentkey":"com.linkedin.sdui.profile.card.refexampleAbout","children":["$L9","$La"]}]}]',
    '9:["$","$Lf",null,{"textProps":{"fontSize":"xlarge","tagName":"h2","children":["About"]}}]',
    `a:["$","$L11",null,{"textProps":{"fontSize":"small","children":["${escapeJson(text)}"]}}]`
  ].join("\n");
}

function escapeJson(value) {
  return String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function postJson(server, path, body) {
  const address = server.address();

  return new Promise((resolve, reject) => {
    const request = http.request(
      {
        method: "POST",
        host: "127.0.0.1",
        port: address.port,
        path,
        headers: {
          "content-type": "application/json"
        }
      },
      (response) => {
        let text = "";

        response.on("data", (chunk) => {
          text += chunk;
        });

        response.on("end", () => {
          resolve({
            statusCode: response.statusCode,
            body: JSON.parse(text)
          });
        });
      }
    );

    request.on("error", reject);
    request.end(JSON.stringify(body));
  });
}

function restoreEnv(name, value) {
  if (value === undefined) {
    delete process.env[name];
    return;
  }

  process.env[name] = value;
}
