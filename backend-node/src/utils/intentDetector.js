/**
 * Intent Detector — identifies temporal/chronological transaction queries
 *
 * Detects patterns like:
 *   "last 5 transactions", "my recent 10 transactions",
 *   "first 3 transactions", "oldest 5 transactions"
 *
 * Returns: { isTemporal: boolean, count: number, order: 'desc' | 'asc' }
 */

const TEMPORAL_PATTERNS = [
  // "last/recent/past N transactions"
  {
    regex: /(?:last|recent|latest|past|previous)\s+(\d+)\s+transactions?/i,
    order: "desc",
  },
  // "first/oldest/earliest N transactions"
  {
    regex: /(?:first|oldest|earliest|initial)\s+(\d+)\s+transactions?/i,
    order: "asc",
  },
  // "N most recent/latest transactions"
  {
    regex: /(\d+)\s+(?:most\s+)?(?:recent|latest)\s+transactions?/i,
    order: "desc",
  },
  // "N oldest/earliest transactions"
  {
    regex: /(\d+)\s+(?:most\s+)?(?:oldest|earliest)\s+transactions?/i,
    order: "asc",
  },
];

const MAX_TEMPORAL_COUNT = 50;

export const detectTemporalIntent = (message) => {
  for (const { regex, order } of TEMPORAL_PATTERNS) {
    const match = message.match(regex);
    if (match) {
      const count = Math.min(parseInt(match[1], 10), MAX_TEMPORAL_COUNT);
      return { isTemporal: true, count, order };
    }
  }
  return { isTemporal: false, count: 0, order: null };
};
