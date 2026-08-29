import assert from "node:assert/strict";
import test from "node:test";
import { extractAboutFromProfilePage, getBasicProfile, parseBasicProfilePage } from "../src/basic-profile.js";

test("parses requested profile top-card fields from profile page HTML", () => {
  const html = `
    <html>
      <head>
        <link rel="preload" as="image" imageSrcSet="https://media.licdn.com/dms/image/profile-displaybackgroundimage-shrink_200_800/bg-small?e=1&amp;t=small 800w, https://media.licdn.com/dms/image/profile-displaybackgroundimage-shrink_350_1400/bg-large?e=1&amp;t=large 1400w"/>
        <link rel="preload" as="image" imageSrcSet="https://media.licdn.com/dms/image/profile-displayphoto-scale_100_100/photo-small?e=1&amp;t=small 100w, https://media.licdn.com/dms/image/profile-displayphoto-crop_800_800/photo-large?e=1&amp;t=large 800w"/>
      </head>
      <body>
        <main>
          <h2>Abhishek Dhumansur</h2>
          <p>He/Him</p>
          <p>· 1st</p>
          <p>· 2nd</p>
          <p><span>Senior Engineer at Bosch Global Software Technologies</span></p>
          <p>Bosch Global Software Technologies · Government Tool Room &amp; Training Centre</p>
          <p>Ramanagara, Karnataka, India</p>
          <p>·</p>
          <p><a href="https://www.linkedin.com/in/abhishek-dhumansur6366/overlay/contact-info/">Contact info</a></p>
          <img src="https://media.licdn.com/dms/image/other-profile-displayphoto-scale_400_400/noise"/>
        </main>
      </body>
    </html>
  `;

  assert.deepEqual(parseBasicProfilePage(html, "abhishek-dhumansur6366"), {
    name: "Abhishek Dhumansur",
    headline: "Senior Engineer at Bosch Global Software Technologies",
    location: "Ramanagara, Karnataka, India",
    pronouns: "He/Him",
    about: null,
    profileImage: "https://media.licdn.com/dms/image/profile-displayphoto-crop_800_800/photo-large?e=1&t=large",
    backgroundImage: "https://media.licdn.com/dms/image/profile-displaybackgroundimage-shrink_350_1400/bg-large?e=1&t=large",
    isSelfProfile: false
  });
});

test("parses profile when pronouns are absent", () => {
  const html = `
    <html>
      <head>
        <title>Example Person | LinkedIn</title>
        <link rel="preload" as="image" imageSrcSet="https://media.licdn.com/dms/image/profile-displayphoto-scale_200_200/photo 200w"/>
        <link rel="preload" as="image" imageSrcSet="https://media.licdn.com/dms/image/profile-displaybackgroundimage-shrink_200_800/bg 800w"/>
      </head>
      <body>
        <main>
          <h2>Example Person</h2>
          <p>Software Engineer | Backend &amp; Full Stack</p>
          <p>Example Company · Example University</p>
          <p>Greater Bengaluru Area</p>
          <p>·</p>
          <p><a href="https://www.linkedin.com/in/example-person/overlay/contact-info/">Contact info</a></p>
        </main>
      </body>
    </html>
  `;

  assert.deepEqual(parseBasicProfilePage(html, "example-person"), {
    name: "Example Person",
    headline: "Software Engineer | Backend & Full Stack",
    location: "Greater Bengaluru Area",
    pronouns: null,
    about: null,
    profileImage: "https://media.licdn.com/dms/image/profile-displayphoto-scale_200_200/photo",
    backgroundImage: "https://media.licdn.com/dms/image/profile-displaybackgroundimage-shrink_200_800/bg",
    isSelfProfile: false
  });
});

test("parses requested profile About from a rendered profile section", () => {
  const html = `
    <html>
      <body>
        <footer>
          <a href="https://about.linkedin.com/">About</a>
        </footer>
        <main>
          <section componentkey="sangamesh-lingshetty-5a6647279_about">
            <h2>About</h2>
            <p>I&#39;m a Backend / Full Stack Engineer building production systems.</p>
          </section>
          <section>
            <h2>Activity</h2>
          </section>
        </main>
      </body>
    </html>
  `;

  assert.equal(
    extractAboutFromProfilePage(html, "sangamesh-lingshetty-5a6647279"),
    "I'm a Backend / Full Stack Engineer building production systems."
  );
});

test("parses requested profile About from serialized profile page data", () => {
  const html = `
    <script>
      10:["$","section",null,{"componentKey":"abhishek-dhumansur6366_about","children":[
        ["$","h2",null,{"children":["About"]}],
        ["$","p",null,{"children":["Mechanical Design Engineer with 4+ years of experience in product design."]}],
        ["$","h2",null,{"children":["Activity"]}]
      ]}]
    </script>
  `;

  assert.equal(
    extractAboutFromProfilePage(html, "abhishek-dhumansur6366"),
    "Mechanical Design Engineer with 4+ years of experience in product design."
  );
});

test("keeps About extraction target-specific", () => {
  const html = `
    <script>
      1:["$","section",null,{"componentKey":"sangamesh-lingshetty-5a6647279_about","children":[
        ["$","h2",null,{"children":["About"]}],
        ["$","p",null,{"children":["I'm a Backend / Full Stack Engineer building production systems."]}]
      ]}]
      2:["$","section",null,{"componentKey":"abhishek-dhumansur6366_about","children":[
        ["$","h2",null,{"children":["About"]}],
        ["$","p",null,{"children":["Mechanical Design Engineer with 4+ years of experience in product design."]}]
      ]}]
    </script>
  `;

  assert.match(
    extractAboutFromProfilePage(html, "abhishek-dhumansur6366"),
    /^Mechanical Design Engineer/
  );
});

test("does not return unresolved serialized references as About", () => {
  const html = `
    <script>
      1:["$","section",null,{"componentKey":"example_about","children":[
        ["$","h2",null,{"children":["About"]}],
        ["$","p",null,{"children":["$L42"]}]
      ]}]
    </script>
  `;

  assert.equal(extractAboutFromProfilePage(html, "example"), null);
});

test("returns null when requested profile About is missing", () => {
  const html = `
    <main>
      <section>
        <h2>Experience</h2>
        <p>Example Company</p>
      </section>
    </main>
  `;

  assert.equal(extractAboutFromProfilePage(html, "example"), null);
});

test("ignores footer About navigation", () => {
  const html = `
    <main>
      <h2>Example Person</h2>
      <p>Example Headline</p>
    </main>
    <script>
      1:["$","nav",null,{"children":[
        ["$","p",null,{"children":["About"]}],
        ["$","p",null,{"children":["Accessibility"]}],
        ["$","p",null,{"children":["Talent Solutions"]}]
      ]}]
    </script>
  `;

  assert.equal(extractAboutFromProfilePage(html, "example"), null);
});

test("detects authenticated user's own profile page", () => {
  const html = `
    <html>
      <head><title>Example Person | LinkedIn</title></head>
      <body>
        <main>
          <h2>Example Person</h2>
          <p>Example Headline</p>
          <p>Example City</p>
          <p><a href="https://www.linkedin.com/in/example-person/overlay/contact-info/">Contact info</a></p>
        </main>
        <script>com.linkedin.sdui.flagshipnav.profile.ProfileEditIntroForm</script>
      </body>
    </html>
  `;

  assert.equal(parseBasicProfilePage(html, "example-person").isSelfProfile, true);
});

test("getBasicProfile performs an authenticated profile page GET", async (t) => {
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

    return new Response(`
      <html>
        <head>
          <title>Example Person | LinkedIn</title>
          <link rel="preload" as="image" imageSrcSet="https://media.licdn.com/dms/image/profile-displayphoto-scale_200_200/photo 200w"/>
          <link rel="preload" as="image" imageSrcSet="https://media.licdn.com/dms/image/profile-displaybackgroundimage-shrink_200_800/bg 800w"/>
        </head>
        <body>
          <main>
            <h2>Example Person</h2>
            <p>Example Headline</p>
            <p>Example City</p>
            <p>·</p>
            <p><a href="https://www.linkedin.com/in/example-person/overlay/contact-info/">Contact info</a></p>
          </main>
        </body>
      </html>
    `, {
      status: 200,
      headers: {
        "content-type": "text/html"
      }
    });
  };

  t.after(() => {
    global.fetch = originalFetch;
    restoreEnv("LINKEDIN_COOKIE", originalCookie);
    restoreEnv("LINKEDIN_CSRF_TOKEN", originalCsrf);
  });

  const result = await getBasicProfile("example-person");

  assert.equal(capturedUrl.pathname, "/in/example-person/");
  assert.equal(capturedOptions.method, "GET");
  assert.equal(capturedOptions.headers.referer, "https://www.linkedin.com/");
  assert.equal(capturedOptions.headers["content-type"], undefined);
  assert.equal(capturedOptions.headers.origin, undefined);
  assert.equal(result.linkedinStatus, 200);
  assert.equal(result.value.name, "Example Person");
});

function restoreEnv(name, value) {
  if (value === undefined) {
    delete process.env[name];
    return;
  }

  process.env[name] = value;
}
