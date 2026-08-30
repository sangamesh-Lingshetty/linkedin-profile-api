import { AppError, linkedinRequest } from "./linkedin-client.js";
import {
  extractNextEducationStart,
  extractEducationPaginationInfo,
  parseEducation
} from "./rsc-parser.js";

const PAGER_ID = "com.linkedin.sdui.pagers.profile.details.education";
const SCREEN_ID = "com.linkedin.sdui.flagshipnav.profile.ProfileEducationDetails";
const PAGE_SIZE = 10;
const MAX_PAGES = 20;

export async function getEducation(vanityName) {
  const referer = `https://www.linkedin.com/in/${encodeURIComponent(vanityName)}/details/education/`;

  const screenResponse = await linkedinRequest({
    path: `/flagship-web/in/${encodeURIComponent(vanityName)}/details/education/`,
    method: "POST",
    referer,
    headers: {
      "x-li-rsc-stream": "true",
      "x-li-anchor-page-key": "d_flagship3_profile_view_base",
      "x-li-initial-url": `/in/${vanityName}/`
    },
    body: buildEducationScreenBody(vanityName)
  });

  assertRscResponse(screenResponse);

  const paginationInfo = extractEducationPaginationInfo(screenResponse.text);

  const allEntries = [];
  let nextStart = 0;
  let durationMs = screenResponse.durationMs;
  let linkedinStatus = screenResponse.status;
  const requestedStarts = new Set();

  for (let page = 0; page < MAX_PAGES && nextStart !== null; page++) {
    requestedStarts.add(nextStart);

    const paginationResponse = await linkedinRequest({
      path: `/flagship-web/rsc-action/actions/pagination?sduiid=${PAGER_ID}`,
      method: "POST",
      referer,
      headers: {
        "x-li-rsc-stream": "true",
        "x-li-anchor-page-key": "d_flagship3_profile_view_base_education_details"
      },
      body: buildEducationPaginationBody(vanityName, paginationInfo, nextStart)
    });

    assertRscResponse(paginationResponse);

    allEntries.push(...parseEducation(paginationResponse.text));
    nextStart = extractNextEducationStart(paginationResponse.text);
    if (nextStart !== null && requestedStarts.has(nextStart)) {
      nextStart = null;
    }

    durationMs += paginationResponse.durationMs;
    linkedinStatus = paginationResponse.status;
  }

  return {
    entries: dedupeEducation(allEntries),
    linkedinStatus,
    durationMs
  };
}

function buildEducationScreenBody(vanityName) {
  return {
    $type: "proto.sdui.actions.core.NavigateToScreen",
    screenId: SCREEN_ID,
    pageKey: "profile_view_base_education_details",
    presentationStyle: "PresentationStyle_FULL_PAGE",
    presentation: {
      $case: "fullPage",
      fullPage: {
        $type: "proto.sdui.actions.core.presentation.FullPagePresentation"
      }
    },
    title: "",
    url: `/in/${vanityName}/details/education/`,
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

function buildEducationPaginationBody(vanityName, paginationInfo, start) {
  const payload = {
    vanityName,
    profileId: paginationInfo.profileId,
    start,
    count: PAGE_SIZE,
    detailSectionReplaceableComponentRef:
      paginationInfo.detailSectionReplaceableComponentRef
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

function dedupeEducation(education) {
  const seen = new Set();

  return education.filter((entry) => {
    const key = [entry.school, entry.degree, entry.dateRange]
      .map((value) => String(value || "").toLowerCase())
      .join("|");

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
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
