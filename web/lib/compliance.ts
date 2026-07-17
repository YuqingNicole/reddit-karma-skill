/**
 * Compliance constants for autoreddit.ai.
 *
 * This product uses Reddit's OFFICIAL API over OAuth2, discloses that actions
 * are automated, and never posts without explicit human approval. These are
 * the guardrails the whole app is built around — do not route around them.
 */

// Reddit's documented OAuth API budget is 100 requests/minute per client
// (averaged over a 10-minute window). We stay comfortably under it.
export const REDDIT_RATE = {
  requestsPerMinute: 60, // conservative ceiling (< Reddit's 100/min)
  minGapMsBetweenWrites: 2000, // spacing between submit/comment calls
} as const;

// Product-level posting limits. Deliberately conservative to protect accounts
// and stay well within community norms. Surfaced in the UI as meters.
export const POSTING_LIMITS = {
  commentsPerDay: 15,
  postsPerDay: 3,
  scheduledJobsPerAccount: 200,
} as const;

// Shown to users, and appended to automated posts when disclosure is enabled.
export const DISCLOSURE = {
  bannerText:
    "autoreddit.ai acts through Reddit's official API on your behalf. " +
    "Every action is logged, rate-limited, and — for anything that posts — " +
    "requires your explicit approval first.",
  postFooter: "Scheduled with autoreddit.ai",
} as const;

// OAuth scopes we request. Keep this minimal and honest about what we do.
export const REDDIT_SCOPES = [
  "identity", // who the user is
  "read", // read posts/comments to build the inbox + context
  "submit", // create posts/comments (only after human approval)
  "privatemessages", // read replies / inbox
  "history", // read the user's own post/comment history
] as const;

/**
 * Rules the AI drafting assistant must follow. The assistant SUGGESTS; a human
 * reviews and approves before anything is sent through the official API.
 */
export const DRAFTING_POLICY = {
  requireHumanApproval: true,
  autoSend: false,
  // No impersonation / fake-persona generation. Drafts are suggestions the
  // account owner edits and owns.
  allowPersonaImpersonation: false,
} as const;
