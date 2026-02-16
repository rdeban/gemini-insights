const fs = require('fs');
const path = require('path');
const { extractJson, logger } = require('./utils');

const sessionId = process.argv[2];
const jsonStr = process.argv[3];

if (!sessionId || !jsonStr) {
  logger.error("Usage: node save-facet.js <sessionId> <jsonStr>");
  process.exit(1);
}

try {
  const data = extractJson(jsonStr);
  if (!data) throw new Error("No valid JSON found in input");

  // Save to the extension's central local cache (3 levels up from scripts/ inside a skill)
  const cacheDir = path.join(__dirname, '..', '..', '..', '.insights-cache', 'facets');
  if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });

  const filePath = path.join(cacheDir, `${sessionId}.json`);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  logger.info(`Saved facet for ${sessionId}`);
} catch (e) {
  logger.error(`Failed to save facet for ${sessionId}`, e);
  process.exit(1);
}
