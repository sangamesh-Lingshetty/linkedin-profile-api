import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { getAbout } from "../src/about.js";
import { parseAboutResponse } from "../src/rsc-parser.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ABOUT_SCREEN_ID = "com.linkedin.sdui.flagshipnav.profile.ProfileAboutForm";

test("getAbout uses the RSC navigation action request", async (t) => {
  const originalFetch = global.fetch;
  const originalCookie = process.env.LINKEDIN_COOKIE;
  const originalCsrf = process.env.LINKEDIN_CSRF_TOKEN;
  let capturedUrl;
  let capturedOptions;

  process.env.LINKEDIN_COOKIE = "dummy-cookie";
  process.env.LINKEDIN_CSRF_TOKEN = "dummy-csrf";

  global.fetch = async (url, options) => {
    capturedUrl = new URL(String(url));
    capturedOptions = options;

    return new Response(readFixture("about-rsc.txt"), {
      status: 200,
      headers: {
        "content-type": "text/x-component"
      }
    });
  };

  t.after(() => {
    global.fetch = originalFetch;
    restoreEnv("LINKEDIN_COOKIE", originalCookie);
    restoreEnv("LINKEDIN_CSRF_TOKEN", originalCsrf);
  });

  const result = await getAbout("example");
  const body = JSON.parse(capturedOptions.body);

  assert.equal(result.value.includes("Backend / Full Stack Engineer"), true);
  assert.equal(capturedUrl.pathname, "/flagship-web/rsc-action/actions/navigation");
  assert.equal(capturedUrl.searchParams.get("screenId"), ABOUT_SCREEN_ID);
  assert.equal(capturedUrl.searchParams.get("sduiid"), ABOUT_SCREEN_ID);
  assert.equal(String(capturedUrl).includes("/edit/forms/about/"), false);
  assert.equal(capturedOptions.method, "POST");
  assert.equal(capturedOptions.headers.accept, "*/*");
  assert.equal(capturedOptions.headers["content-type"], "application/json");
  assert.equal(capturedOptions.headers.origin, undefined);
  assert.equal(capturedOptions.headers["accept-language"], undefined);
  assert.equal(capturedOptions.headers["x-li-lang"], undefined);
  assert.equal(capturedOptions.headers["x-li-track"], undefined);
  assert.equal(capturedOptions.headers["x-restli-protocol-version"], undefined);
  assert.equal(capturedOptions.headers["x-li-rsc-stream"], "true");
  assert.equal(capturedOptions.headers["x-li-anchor-page-key"], "d_flagship3_profile_view_base");
  assert.equal(capturedOptions.headers["x-li-initial-url"], undefined);
  assert.equal(capturedOptions.headers["x-li-application-version"], "0.2.7003");
  assert.deepEqual(JSON.parse(capturedOptions.headers["x-li-layout-tree"]), [
    "com.linkedin.sdui.flagshipnav.profile.Profile#696664d3",
    "com.linkedin.sdui.flagshipnav.home.Home#0",
    "a15eca777c146d37da0475b8f19e5d56"
  ]);
  assert.equal(capturedOptions.headers["x-li-application-instance"], undefined);
  assert.equal(capturedOptions.headers["x-li-page-instance-tracking-id"], undefined);
  assert.equal(capturedOptions.headers["x-li-page-instance"], undefined);
  assert.equal(capturedOptions.headers["x-li-pageforestid"], undefined);
  assert.equal(capturedOptions.headers["x-li-traceparent"], undefined);
  assert.equal(capturedOptions.headers["x-li-tracestate"], undefined);
  assert.equal(capturedOptions.headers.referer, "https://www.linkedin.com/in/example/edit/forms/summary/new/");
  assert.equal(body.isModal, true);
  assert.equal(body.clientArguments.$type, "proto.sdui.actions.requests.RequestedArguments");
  assert.deepEqual(body.clientArguments.requestedStateKeys, []);
  assert.equal(body.clientArguments.payload.vanityName, "example");
  assert.equal(body.clientArguments.payload.isVanityNameResolved, true);
  assert.equal(body.clientArguments.payload.profileFormEntryPoint, undefined);
  assert.equal(body.clientArguments.screenId, ABOUT_SCREEN_ID);
  assert.deepEqual(body.clientArguments.knownTemplateIds, []);
  assert.equal(body.$type, undefined);
  assert.equal(body.requestedArguments, undefined);
});

test("finds ProfileAboutForm and resolves About RSC reference", () => {
  const raw = readFixture("about-rsc.txt");

  assert.equal(
    parseAboutResponse(raw),
    "I'm a Backend / Full Stack Engineer focused on APIs and automation.\n\nI build reliable Node.js services, integrations, and internal tools."
  );
});

test("preserves multiline About text", () => {
  const about = parseAboutResponse(readFixture("about-rsc.txt"));

  assert.match(about, /automation\.\n\nI build reliable/);
});

test("does not return raw RSC references", () => {
  const about = parseAboutResponse(readFixture("about-rsc.txt"));

  assert.equal(/^\$L?[a-zA-Z0-9]+$/.test(about), false);
});

test("missing About returns null", () => {
  const raw = '1:{"screenId":"com.linkedin.sdui.flagshipnav.profile.ProfileAboutForm"}';

  assert.equal(parseAboutResponse(raw), null);
});

test("malformed non-About RSC does not produce unrelated text", () => {
  const raw = "1:T30,This text is not an About form";

  assert.equal(parseAboutResponse(raw), null);
});

test("supports non-numeric About RSC refs", () => {
  const raw = [
    '1:{"screenId":"com.linkedin.sdui.flagshipnav.profile.ProfileAboutForm"}',
    '2:{"id":"aboutSomethingProfileAboutForm","value":{"stringValue":"$Lc"}}',
    "c:T23,Letter-key About text"
  ].join("\n");

  assert.equal(parseAboutResponse(raw), "Letter-key About text");
});

function readFixture(fileName) {
  return readFileSync(join(__dirname, "fixtures", fileName), "utf8");
}

function restoreEnv(name, value) {
  if (value === undefined) {
    delete process.env[name];
    return;
  }

  process.env[name] = value;
}
