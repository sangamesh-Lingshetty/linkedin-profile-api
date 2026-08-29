import { AppError, linkedinRequest } from "./linkedin-client.js";
import {
  extractEducationPaginationInfo,
  parseEducation
} from "./rsc-parser.js";

const PAGER_ID = "com.linkedin.sdui.pagers.profile.details.education";
const SCREEN_ID = "com.linkedin.sdui.flagshipnav.profile.ProfileEducationDetails";

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

  const paginationResponse = await linkedinRequest({
    path: `/flagship-web/rsc-action/actions/pagination?sduiid=${PAGER_ID}`,
    method: "POST",
    referer,
    headers: {
      "x-li-rsc-stream": "true",
      "x-li-anchor-page-key": "d_flagship3_profile_view_base_education_details"
    },
    body: buildEducationPaginationBody(vanityName, paginationInfo)
  });

  assertRscResponse(paginationResponse);

  const entries = parseEducation(paginationResponse.text);

  return {
    entries,
    linkedinStatus: paginationResponse.status,
    durationMs: screenResponse.durationMs + paginationResponse.durationMs
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

function buildEducationPaginationBody(vanityName, paginationInfo) {
  const payload = {
    vanityName,
    profileId: paginationInfo.profileId,
    start: 0,
    count: 10,
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
