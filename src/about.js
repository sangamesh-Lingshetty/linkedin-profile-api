import { AppError, linkedinRequest } from "./linkedin-client.js";
import { parseAboutResponse } from "./rsc-parser.js";

const COMPONENT_ID = "com.linkedin.sdui.generated.profile.dsl.impl.profileCardsAboveActivity";
const SCREEN_ID = "com.linkedin.sdui.flagshipnav.profile.Profile";

export async function getAbout(vanityName) {
  const response = await linkedinRequest({
    path:
      `/flagship-web/rsc-action/actions/component` +
      `?componentId=${encodeURIComponent(COMPONENT_ID)}` +
      `&sduiid=${encodeURIComponent(COMPONENT_ID)}`,
    method: "POST",
    referer: `https://www.linkedin.com/in/${encodeURIComponent(vanityName)}/`,
    headers: buildAboutHeaders(),
    body: buildAboutComponentBody(vanityName)
  });

  assertRscResponse(response);

  return {
    value: parseAboutResponse(response.text),
    linkedinStatus: response.status,
    durationMs: response.durationMs
  };
}

export function buildAboutComponentBody(vanityName) {
  return {
    clientArguments: {
      payload: {
        isSelfView: false,
        vanityName,
        replaceableSectionArgs: {
          vanityName,
          hideCardsForGoldenGate: false,
          shouldSetupReplaceableComponent: true,
          isSelfView: false,
          isSelfViewResolved: false
        },
        profileComponentState: buildProfileComponentState(vanityName)
      },
      states: [],
      requestMetadata: {
        $type: "proto.sdui.common.RequestMetadata"
      },
      screenId: SCREEN_ID,
      knownTemplateIds: []
    }
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
    "x-li-anchor-page-key": "d_flagship3_profile_view_base"
  };
}

function buildProfileComponentState(vanityName) {
  const binding = (name) => ({
    type: "com.linkedin.sdui.components.core.BindingImpl",
    value: {
      key: `ProfileComponentState${name}${vanityName}ProfileComponentState`,
      namespace: "MemoryNamespace"
    }
  });

  return {
    profileId: vanityName,
    shouldRefreshScreenOnReappear: binding("ShouldRefreshScreen"),
    shouldFetchFromCache: binding("FetchFromCache"),
    shouldDisplayTabAnchors: binding("ShouldDisplayTabAnchors"),
    shouldReloadTopCardOnReappear: binding("ShouldReloadTopCardOnReappear"),
    deferredTopCardReloadProfileId: binding("DeferredTopCardReloadProfileId"),
    shouldDisplayStickyHeader: binding("ShouldDisplayStickyHeader"),
    shouldRefreshLanguageDetailScreen: binding("ShouldRefreshLanguageDetails"),
    lastPerformedActionRef: binding("LastPerformedActionRef"),
    shouldFocusOnReappear: binding("ShouldFocusOnReappear"),
    shouldFocusFeaturedOnReappear: binding("ShouldFocusFeaturedOnReappear")
  };
}

function assertRscResponse(response) {
  if (response.text.trimStart().toLowerCase().startsWith("<!doctype html")) {
    throw new AppError(
      "LINKEDIN_REQUEST_FAILED",
      "LinkedIn returned HTML instead of the RSC/SDUI stream.",
      502,
      response.status
    );
  }
}
