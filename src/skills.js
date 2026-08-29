import { AppError, linkedinRequest } from "./linkedin-client.js";
import {
  extractNextSkillsStart,
  extractSkillsProfileId,
  parseSkills
} from "./rsc-parser.js";

const PAGER_ID = "com.linkedin.sdui.pagers.profile.details.skills";
const SCREEN_ID = "com.linkedin.sdui.flagshipnav.profile.ProfileSkillDetails";
const FILTER = "ProfileSkillCategory_ALL";
const PAGE_SIZE = 10;
const MAX_PAGES = 20;

export async function getSkills(vanityName) {
  const referer = `https://www.linkedin.com/in/${encodeURIComponent(vanityName)}/details/skills/`;

  const screenResponse = await linkedinRequest({
    path: `/flagship-web/in/${encodeURIComponent(vanityName)}/details/skills/`,
    method: "POST",
    referer,
    headers: {
      "x-li-rsc-stream": "true",
      "x-li-anchor-page-key": "d_flagship3_profile_view_base",
      "x-li-initial-url": `/in/${vanityName}/`
    },
    body: buildSkillsScreenBody(vanityName)
  });

  assertRscResponse(screenResponse);

  const profileId = extractSkillsProfileId(screenResponse.text);
  if (!profileId) {
    throw new AppError("EXTRACTION_FAILED", "LinkedIn skills profileId could not be extracted.", 502);
  }

  const allSkills = [];
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
        "x-li-anchor-page-key": "d_flagship3_profile_view_base_skills_details"
      },
      body: buildSkillsPaginationBody(vanityName, profileId, nextStart)
    });

    assertRscResponse(paginationResponse);

    allSkills.push(...parseSkills(paginationResponse.text));
    nextStart = extractNextSkillsStart(paginationResponse.text);
    if (nextStart !== null && requestedStarts.has(nextStart)) {
      nextStart = null;
    }

    durationMs += paginationResponse.durationMs;
    linkedinStatus = paginationResponse.status;
  }

  return {
    entries: dedupeSkills(allSkills),
    linkedinStatus,
    durationMs
  };
}

function buildSkillsScreenBody(vanityName) {
  return {
    $type: "proto.sdui.actions.core.NavigateToScreen",
    screenId: SCREEN_ID,
    pageKey: "profile_view_base_skills_details",
    presentationStyle: "PresentationStyle_FULL_PAGE",
    presentation: {
      $case: "fullPage",
      fullPage: {
        $type: "proto.sdui.actions.core.presentation.FullPagePresentation"
      }
    },
    title: "",
    url: `/in/${vanityName}/details/skills/`,
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

function buildSkillsPaginationBody(vanityName, profileId, start) {
  const payload = {
    vanityName,
    profileId,
    start,
    count: PAGE_SIZE,
    filter: FILTER
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

function dedupeSkills(skills) {
  const seen = new Set();

  return skills.filter((skill) => {
    const key = skill.id || skill.name.toLowerCase();
    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}
