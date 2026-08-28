import { AppError, linkedinRequest } from "./linkedin-client.js";
import { parseExperience } from "./rsc-parser.js";

export async function getExperience(vanityName) {
  const path = `/flagship-web/in/${encodeURIComponent(vanityName)}/details/experience/`;
  const referer = `https://www.linkedin.com/in/${encodeURIComponent(vanityName)}/details/experience/`;

  const response = await linkedinRequest({
    path,
    method: "POST",
    referer,
    headers: {
      "x-li-rsc-stream": "true",
      "x-li-anchor-page-key": "d_flagship3_profile_view_base",
      "x-li-initial-url": `/in/${vanityName}/`
    },
    body: buildExperienceRequestBody(vanityName),
  });

  if (response.text.trimStart().toLowerCase().startsWith("<!doctype html")) {
    throw new AppError(
      "LINKEDIN_REQUEST_FAILED",
      "LinkedIn returned HTML instead of the RSC/SDUI stream.",
      502,
      response.status,
    );
  }

  const entries = parseExperience(response.text);
  if (entries.length === 0) {
    throw new AppError(
      "EXTRACTION_FAILED",
      "No experience entries could be extracted.",
      502,
    );
  }

  return {
    entries,
    linkedinStatus: response.status,
    durationMs: response.durationMs,
  };
}

function buildExperienceRequestBody(vanityName) {
  return {
    $type: "proto.sdui.actions.core.NavigateToScreen",

    screenId: "com.linkedin.sdui.flagshipnav.profile.ProfileExperienceDetails",

    pageKey: "profile_view_base_position_details",

    presentationStyle: "PresentationStyle_FULL_PAGE",

    presentation: {
      $case: "fullPage",
      fullPage: {
        $type: "proto.sdui.actions.core.presentation.FullPagePresentation",
      },
    },

    title: "",

    url: `/in/${vanityName}/details/experience/`,

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
        vanityName,
      },

      states: [],

      requestMetadata: {
        $type: "proto.sdui.common.RequestMetadata",
      },

      screenId: "",
      knownTemplateIds: [],
    },
  };
}
