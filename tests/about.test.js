import assert from "node:assert/strict";
import test from "node:test";
import { buildAboutComponentBody, getAbout } from "../src/about.js";
import { parseAboutResponse } from "../src/rsc-parser.js";

const COMPONENT_ID = "com.linkedin.sdui.generated.profile.dsl.impl.profileCardsAboveActivity";

test("getAbout uses the read-only profile component request", async (t) => {
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

    return new Response(componentAboutFixture("example", "Example About text."), {
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

  assert.equal(result.value, "Example About text.");
  assert.equal(capturedUrl.pathname, "/flagship-web/rsc-action/actions/component");
  assert.equal(capturedUrl.searchParams.get("componentId"), COMPONENT_ID);
  assert.equal(capturedUrl.searchParams.get("sduiid"), COMPONENT_ID);
  assert.equal(capturedUrl.searchParams.has("parentSpanId"), false);
  assert.equal(capturedOptions.method, "POST");
  assert.equal(capturedOptions.headers.accept, "*/*");
  assert.equal(capturedOptions.headers["content-type"], "application/json");
  assert.equal(capturedOptions.headers["x-li-rsc-stream"], "true");
  assert.equal(capturedOptions.headers["x-li-anchor-page-key"], "d_flagship3_profile_view_base");
  assert.equal(capturedOptions.headers.referer, "https://www.linkedin.com/in/example/");
  assert.equal(capturedOptions.headers.origin, undefined);
  assert.equal(capturedOptions.headers["x-li-track"], undefined);
  assert.equal(capturedOptions.headers["x-li-page-instance"], undefined);
  assert.equal(capturedOptions.headers["x-li-page-instance-tracking-id"], undefined);
  assert.equal(capturedOptions.headers["x-li-pageforestid"], undefined);
  assert.equal(capturedOptions.headers["x-li-traceparent"], undefined);
  assert.equal(capturedOptions.headers["x-li-tracestate"], undefined);
  assert.equal(capturedOptions.headers["x-li-application-instance"], undefined);
  assert.equal(capturedOptions.headers["x-li-application-version"], undefined);
  assert.equal(body.clientArguments.payload.vanityName, "example");
  assert.equal(body.clientArguments.payload.replaceableSectionArgs.vieweeProfileId, undefined);
  assert.equal(body.clientArguments.payload.profileComponentState.profileId, "example");
  assert.equal(body.clientArguments.screenId, "com.linkedin.sdui.flagshipnav.profile.Profile");
  assert.deepEqual(body.clientArguments.states, []);
  assert.deepEqual(body.clientArguments.knownTemplateIds, []);
});

test("buildAboutComponentBody generates vanity-scoped profile state bindings", () => {
  const body = buildAboutComponentBody("example-person");
  const state = body.clientArguments.payload.profileComponentState;

  assert.equal(state.shouldFetchFromCache.value.key, "ProfileComponentStateFetchFromCacheexample-personProfileComponentState");
  assert.equal(state.shouldFocusOnReappear.value.namespace, "MemoryNamespace");
});

test("parses the About card and preserves line breaks", () => {
  const about = parseAboutResponse(componentAboutFixture(
    "abhishek-dhumansur6366",
    [
      "Mechanical Design Engineer with 4+ years of experience.",
      "Core Skills:",
      "Siemens NX",
      "Mechanical Design"
    ]
  ));

  assert.equal(
    about,
    "Mechanical Design Engineer with 4+ years of experience.\nCore Skills:\nSiemens NX\nMechanical Design"
  );
});

test("keeps About parser target-specific within the About card", () => {
  const raw = [
    componentAboutFixture("sangamesh-lingshetty-5a6647279", "I'm a Backend / Full Stack Engineer."),
    componentAboutFixture("abhishek-dhumansur6366", "Mechanical Design Engineer with 4+ years of experience.")
  ].join("\n");

  assert.match(parseAboutResponse(raw), /Backend \/ Full Stack Engineer/);
});

test("missing About card returns null", () => {
  const raw = '1:["$","$L3",null,{"observabilityIdentifier":"com.linkedin.sdui.impl.profile.components.activitySection","children":["$L4"]}]';

  assert.equal(parseAboutResponse(raw), null);
});

test("does not return unresolved refs as About text", () => {
  const raw = componentAboutFixture("example", "$L99");

  assert.equal(parseAboutResponse(raw), null);
});

function componentAboutFixture(vanityName, lines) {
  const aboutLines = Array.isArray(lines) ? lines : [lines];
  const recordPrefix = `r${vanityName.replace(/[^a-z0-9]/gi, "").slice(0, 8)}`;
  const ref = (id) => `${recordPrefix}${id}`;
  const children = aboutLines.map((line, index) =>
    index === 0
      ? `["$","$12","${index}",{"children":[null,"${escapeJson(line)}"]}]`
      : `["$","$12","${index}",{"children":[["$","br",null,{}],"${escapeJson(line)}"]}]`
  );

  return [
    `${ref("0")}:["$","$L${ref("3")}",null,{"observabilityIdentifier":"com.linkedin.sdui.impl.profile.components.aboutSection","children":["$","$L${ref("4")}",null,{"componentKey":"com.linkedin.sdui.profile.card.ref${vanityName}About","children":["$","$L${ref("5")}","com.linkedin.sdui.profile.card.ref${vanityName}About",{"initialContent":"$L${ref("7")}"}]}]}]`,
    `${ref("7")}:["$","$L${ref("4")}",null,{"componentKey":"com.linkedin.sdui.profile.card.ref${vanityName}About","viewTrackingSpecs":{"viewName":"profile-card-about"},"children":["$","section",null,{"componentkey":"com.linkedin.sdui.profile.card.ref${vanityName}About","children":["$L${ref("9")}","$L${ref("a")}"]}]}]`,
    `${ref("9")}:["$","$Lf",null,{"textProps":{"fontSize":"xlarge","tagName":"h2","children":["About"]}}]`,
    `${ref("a")}:["$","$L11",null,{"textProps":{"fontFamily":"sans","fontSize":"small","fontStyle":"normal","fontWeight":"normal","lineHeight":"default","textAlign":"start","children":[[${children.join(",")}]],"linkHoverDecoration":"underline"}}]`
  ].join("\n");
}

function escapeJson(value) {
  return String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function restoreEnv(name, value) {
  if (value === undefined) {
    delete process.env[name];
    return;
  }

  process.env[name] = value;
}
