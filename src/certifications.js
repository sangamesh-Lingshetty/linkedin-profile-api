import { AppError, linkedinRequest } from "./linkedin-client.js";
import {
  extractCertificationsProfileId,
  extractNextCertificationsStart,
  parseCertifications
} from "./rsc-parser.js";

const PAGER_ID = "com.linkedin.sdui.pagers.profile.details.certifications";
const SCREEN_ID = "com.linkedin.sdui.flagshipnav.profile.ProfileCertificationDetails";
const PAGE_SIZE = 10;
const MAX_PAGES = 20;

export async function getCertifications(vanityName) {
  const referer = `https://www.linkedin.com/in/${encodeURIComponent(vanityName)}/details/certifications/`;

  const screenResponse = await requestCertificationsScreen(vanityName, referer);
  if (!screenResponse) {
    return emptyCertifications(404);
  }

  assertRscResponse(screenResponse);

  const profileId = extractCertificationsProfileId(screenResponse.text);
  if (!profileId) {
    throw new AppError(
      "EXTRACTION_FAILED",
      "LinkedIn certifications profileId could not be extracted.",
      502
    );
  }

  const allCertifications = [];
  let nextStart = 0;
  let durationMs = screenResponse.durationMs;
  let linkedinStatus = screenResponse.status;
  const requestedStarts = new Set();

  for (let page = 0; page < MAX_PAGES && nextStart !== null; page++) {
    requestedStarts.add(nextStart);

    const paginationResponse = await requestCertificationsPage(vanityName, profileId, nextStart, referer);
    if (!paginationResponse) {
      nextStart = null;
      continue;
    }

    assertRscResponse(paginationResponse);

    allCertifications.push(...parseCertifications(paginationResponse.text));
    nextStart = extractNextCertificationsStart(paginationResponse.text);
    if (nextStart !== null && requestedStarts.has(nextStart)) {
      nextStart = null;
    }

    durationMs += paginationResponse.durationMs;
    linkedinStatus = paginationResponse.status;
  }

  return {
    entries: dedupeCertifications(allCertifications),
    linkedinStatus,
    durationMs
  };
}

async function requestCertificationsScreen(vanityName, referer) {
  try {
    return await linkedinRequest({
      path: `/flagship-web/in/${encodeURIComponent(vanityName)}/details/certifications/`,
      method: "POST",
      referer,
      headers: {
        "x-li-rsc-stream": "true",
        "x-li-anchor-page-key": "d_flagship3_profile_view_base",
        "x-li-initial-url": `/in/${vanityName}/`
      },
      body: buildCertificationsScreenBody(vanityName)
    });
  } catch (error) {
    if (isMissingCertificationsSection(error)) {
      return null;
    }

    throw error;
  }
}

async function requestCertificationsPage(vanityName, profileId, start, referer) {
  try {
    return await linkedinRequest({
      path: `/flagship-web/rsc-action/actions/pagination?sduiid=${PAGER_ID}`,
      method: "POST",
      referer,
      headers: {
        "x-li-rsc-stream": "true",
        "x-li-anchor-page-key": "d_flagship3_profile_view_base_certifications_details"
      },
      body: buildCertificationsPaginationBody(vanityName, profileId, start)
    });
  } catch (error) {
    if (isMissingCertificationsSection(error)) {
      return null;
    }

    throw error;
  }
}

function buildCertificationsScreenBody(vanityName) {
  return {
    $type: "proto.sdui.actions.core.NavigateToScreen",
    screenId: SCREEN_ID,
    pageKey: "profile_view_base_certifications_details",
    presentationStyle: "PresentationStyle_FULL_PAGE",
    presentation: {
      $case: "fullPage",
      fullPage: {
        $type: "proto.sdui.actions.core.presentation.FullPagePresentation"
      }
    },
    title: "",
    url: `/in/${vanityName}/details/certifications/`,
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

function buildCertificationsPaginationBody(vanityName, profileId, start) {
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

function isMissingCertificationsSection(error) {
  return error instanceof AppError && error.linkedinStatus === 404;
}

function emptyCertifications(linkedinStatus) {
  return {
    entries: [],
    linkedinStatus,
    durationMs: 0
  };
}

function dedupeCertifications(certifications) {
  const seen = new Set();

  return certifications.filter((certification) => {
    const key = certification.id || certification.name;
    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}
