import { AppError, linkedinRequest } from "./linkedin-client.js";
import { parseAboutResponse } from "./rsc-parser.js";

const SCREEN_ID = "com.linkedin.sdui.flagshipnav.profile.ProfileAboutForm";

export async function getAbout(vanityName) {
  const encodedScreenId = encodeURIComponent(SCREEN_ID);
  const encodedVanity = encodeURIComponent(vanityName);
  const referer = `https://www.linkedin.com/in/${encodedVanity}/edit/forms/summary/new/`;
  const path =
    `/flagship-web/rsc-action/actions/navigation` +
    `?screenId=${encodedScreenId}` +
    `&sduiid=${encodedScreenId}`;

  const response = await linkedinRequest({
    path,
    method: "POST",
    referer,
    headers: buildAboutHeaders(),
    body: buildAboutNavigationBody(vanityName),
  });

  assertRscResponse(response);

  return {
    value: parseAboutResponse(response.text),
    linkedinStatus: response.status,
    durationMs: response.durationMs,
  };
}

function buildAboutHeaders() {
  return {
    origin: undefined,
    "accept-language": undefined,
    "x-li-lang": undefined,
    "x-li-track": undefined,
    "x-restli-protocol-version": undefined,
    "x-li-rsc-stream": "true",
    "x-li-anchor-page-key": "d_flagship3_profile_view_base",
    "x-li-application-version": "0.2.7003",
    "x-li-layout-tree": JSON.stringify([
      "com.linkedin.sdui.flagshipnav.profile.Profile#696664d3",
      "com.linkedin.sdui.flagshipnav.home.Home#0",
      "a15eca777c146d37da0475b8f19e5d56"
    ])
  };
}

function buildAboutNavigationBody(vanityName) {
  return {
    clientArguments: {
      $type: "proto.sdui.actions.requests.RequestedArguments",
      requestedStateKeys: [],
      payload: {
        vanityName,
        isVanityNameResolved: true,
      },
      states: [],
      requestMetadata: {
        $type: "proto.sdui.common.RequestMetadata",
      },
      screenId: SCREEN_ID,
      knownTemplateIds: [],
    },
    isModal: true,
  };
}

function assertRscResponse(response) {
  if (response.text.trimStart().toLowerCase().startsWith("<!doctype html")) {
    throw new AppError(
      "LINKEDIN_REQUEST_FAILED",
      "LinkedIn returned HTML instead of the RSC/SDUI stream.",
      502,
      response.status,
    );
  }
}
