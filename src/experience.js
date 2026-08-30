import { AppError, linkedinRequest } from "./linkedin-client.js";
import {
  extractExperienceSkillAssociations,
  parseExperience,
  parseExperienceSkillAssociationDetails
} from "./rsc-parser.js";

const SKILL_ASSOCIATION_SCREEN_ID =
  "com.linkedin.sdui.flagshipnav.profile.ProfileSkillAssociationDetailsScreen";

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
  const associations = extractExperienceSkillAssociations(response.text);
  await enrichExperienceSkills(entries, associations, vanityName, referer);

  return {
    entries,
    linkedinStatus: response.status,
    durationMs: response.durationMs,
  };
}

async function enrichExperienceSkills(entries, associations, vanityName, referer) {
  const associationsByTitle = new Map(
    associations.map((association) => [
      normalizeAssociationTitle(association.associationTitle),
      association
    ])
  );

  for (const entry of entries) {
    const association = associationsByTitle.get(normalizeAssociationTitle(`${entry.title} at ${entry.company}`));
    if (!association) {
      continue;
    }

    try {
      const response = await linkedinRequest({
        path:
          `/flagship-web/rsc-action/actions/navigation` +
          `?screenId=${encodeURIComponent(SKILL_ASSOCIATION_SCREEN_ID)}` +
          `&sduiid=${encodeURIComponent(SKILL_ASSOCIATION_SCREEN_ID)}`,
        method: "POST",
        referer,
        headers: {
          "x-li-rsc-stream": "true",
          "x-li-anchor-page-key": "d_flagship3_profile_view_base_position_details"
        },
        body: buildSkillAssociationBody(vanityName, association)
      });

      assertRscResponse(response);
      entry.skills = parseExperienceSkillAssociationDetails(response.text).filter(
        (skill) => normalizeAssociationTitle(skill) !== normalizeAssociationTitle(association.associationTitle)
      );
    } catch {
      entry.skills = [];
    }
  }
}

function buildSkillAssociationBody(vanityName, association) {
  return {
    clientArguments: {
      $type: "proto.sdui.actions.requests.RequestedArguments",
      requestedStateKeys: [],
      payload: {
        vanityName,
        associationType: association.associationType,
        associationId: association.associationId,
        associationTitle: association.associationTitle,
        isVanityNameResolved: true
      },
      requestMetadata: {
        $type: "proto.sdui.common.RequestMetadata"
      },
      states: [],
      screenId: SKILL_ASSOCIATION_SCREEN_ID,
      knownTemplateIds: []
    },
    isModal: true
  };
}

function normalizeAssociationTitle(value) {
  return String(value || "").replace(/\s+/g, " ").trim().toLowerCase();
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
