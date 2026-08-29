import { AppError, linkedinRequest } from "./linkedin-client.js";
import {
  extractLanguagesProfileId,
  extractNextLanguagesStart,
  parseLanguages
} from "./rsc-parser.js";

const PAGER_ID = "com.linkedin.sdui.pagers.profile.details.languages";
const SCREEN_ID = "com.linkedin.sdui.flagshipnav.profile.ProfileLanguageDetails";
const PAGE_SIZE = 10;
const MAX_PAGES = 20;

export async function getLanguages(vanityName) {
  const referer = `https://www.linkedin.com/in/${encodeURIComponent(vanityName)}/details/languages/`;
  const screenResponse = await requestLanguagesScreen(vanityName, referer);

  if (!screenResponse) {
    return emptyLanguages(404);
  }

  assertRscResponse(screenResponse);

  const profileId = extractLanguagesProfileId(screenResponse.text);
  if (!profileId) {
    return emptyLanguages(screenResponse.status);
  }

  const allLanguages = [];
  let nextStart = 0;
  let durationMs = screenResponse.durationMs;
  let linkedinStatus = screenResponse.status;
  const requestedStarts = new Set();

  for (let page = 0; page < MAX_PAGES && nextStart !== null; page++) {
    requestedStarts.add(nextStart);

    const paginationResponse = await requestLanguagesPage(vanityName, profileId, nextStart, referer);
    if (!paginationResponse) {
      nextStart = null;
      continue;
    }

    assertRscResponse(paginationResponse);

    allLanguages.push(...parseLanguages(paginationResponse.text));
    nextStart = extractNextLanguagesStart(paginationResponse.text);
    if (nextStart !== null && requestedStarts.has(nextStart)) {
      nextStart = null;
    }

    durationMs += paginationResponse.durationMs;
    linkedinStatus = paginationResponse.status;
  }

  return {
    entries: dedupeLanguages(allLanguages),
    linkedinStatus,
    durationMs
  };
}

async function requestLanguagesScreen(vanityName, referer) {
  try {
    return await linkedinRequest({
      path: `/flagship-web/in/${encodeURIComponent(vanityName)}/details/languages/`,
      method: "POST",
      referer,
      headers: {
        "x-li-rsc-stream": "true",
        "x-li-anchor-page-key": "d_flagship3_profile_view_base",
        "x-li-initial-url": `/in/${vanityName}/`
      },
      body: buildLanguagesScreenBody(vanityName)
    });
  } catch (error) {
    if (isMissingLanguagesSection(error)) {
      return null;
    }

    throw error;
  }
}

async function requestLanguagesPage(vanityName, profileId, start, referer) {
  try {
    return await linkedinRequest({
      path: `/flagship-web/rsc-action/actions/pagination?sduiid=${PAGER_ID}`,
      method: "POST",
      referer,
      headers: {
        "x-li-rsc-stream": "true",
        "x-li-anchor-page-key": "d_flagship3_profile_view_base_languages_details"
      },
      body: buildLanguagesPaginationBody(vanityName, profileId, start)
    });
  } catch (error) {
    if (isMissingLanguagesSection(error)) {
      return null;
    }

    throw error;
  }
}

function buildLanguagesScreenBody(vanityName) {
  return {
    $type: "proto.sdui.actions.core.NavigateToScreen",
    screenId: SCREEN_ID,
    pageKey: "profile_view_base_languages_details",
    presentationStyle: "PresentationStyle_FULL_PAGE",
    presentation: {
      $case: "fullPage",
      fullPage: {
        $type: "proto.sdui.actions.core.presentation.FullPagePresentation"
      }
    },
    title: "",
    url: `/in/${vanityName}/details/languages/`,
    inheritActor: false,
    colorScheme: "ColorScheme_UNKNOWN",
    disableScreenGutters: false,
    shouldHideMobileTopNavBar: false,
    shouldHideLoadingSpinner: false,
    replaceCurrentScreen: false,
    shouldHideMobileTopNavBarDivider: false,
    clearBackStack: false,
    requestedArguments: {
      payload: {
        vanityName
      },
      states: [],
      requestMetadata: {
        $type: "proto.sdui.common.RequestMetadata"
      },
      screenId: "",
      knownTemplateIds: []
    }
  };
}

function buildLanguagesPaginationBody(vanityName, profileId, start) {
  const payload = {
    vanityName,
    start,
    count: PAGE_SIZE,
    profileId
  };

  return {
    pagerId: PAGER_ID,
    clientArguments: {
      $type: "proto.sdui.actions.requests.RequestedArguments",
      requestedStateKeys: [],
      payload,
      requestMetadata: {
        $type: "proto.sdui.common.RequestMetadata"
      },
      states: [],
      screenId: SCREEN_ID,
      knownTemplateIds: []
    },
    paginationRequest: {
      $type: "proto.sdui.actions.requests.PaginationRequest",
      pagerId: PAGER_ID,
      trigger: {
        $case: "itemDistanceTrigger",
        itemDistanceTrigger: {
          $type: "proto.sdui.actions.requests.ItemDistanceTrigger",
          preloadDistance: 3,
          preloadLength: 250
        }
      },
      retryCount: 2,
      requestedArguments: {
        $type: "proto.sdui.actions.requests.RequestedArguments",
        requestedStateKeys: [],
        payload,
        requestMetadata: {
          $type: "proto.sdui.common.RequestMetadata"
        }
      }
    }
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

function isMissingLanguagesSection(error) {
  return error instanceof AppError && error.linkedinStatus === 404;
}

function emptyLanguages(linkedinStatus) {
  return {
    entries: [],
    linkedinStatus,
    durationMs: 0
  };
}

function dedupeLanguages(languages) {
  const seen = new Set();

  return languages.filter((language) => {
    const key = language.name.toLowerCase();
    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}
