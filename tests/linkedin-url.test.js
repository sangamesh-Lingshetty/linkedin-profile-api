import assert from "node:assert/strict";
import test from "node:test";
import { AppError } from "../src/linkedin-client.js";
import { extractVanityName } from "../src/linkedin-url.js";

test("extracts vanity names from supported LinkedIn profile URLs", () => {
  assert.equal(extractVanityName("https://www.linkedin.com/in/example/"), "example");
  assert.equal(extractVanityName("https://linkedin.com/in/foo"), "foo");
  assert.equal(extractVanityName("http://www.linkedin.com/in/foo-bar"), "foo-bar");
});

test("rejects invalid LinkedIn profile URLs", () => {
  assert.throws(() => extractVanityName("https://example.com/in/foo"), AppError);
  assert.throws(() => extractVanityName("https://www.linkedin.com/company/foo"), AppError);
  assert.throws(() => extractVanityName("not a url"), AppError);
});
