const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { escapeHtml } = require('./utils');

function generate(stats, synthesis, outputPath) {
  // 1. Pre-calculate userResponseTimes histogram in the generator
  const bins = { "< 2s": 0, "2-10s": 0, "10-30s": 0, "30s-1m": 0, "1-2m": 0, "2-5m": 0, "5-15m": 0, ">15m": 0 };
  if (stats.userResponseTimes) {
    for (const t of stats.userResponseTimes) {
      if (t < 2) bins["< 2s"]++;
      else if (t < 10) bins["2-10s"]++;
      else if (t < 30) bins["10-30s"]++;
      else if (t < 60) bins["30s-1m"]++;
      else if (t < 120) bins["1-2m"]++;
      else if (t < 300) bins["2-5m"]++;
      else if (t < 900) bins["5-15m"]++;
      else bins[">15m"]++;
    }
  }

  // 2. Data Capping & Cleaning
  const cleanStats = {
    tm: stats.totalMessages || 0,
    sa: stats.sessionsAnalyzed || 0,
    la: stats.linesAdded || 0,
    lr: stats.linesRemoved || 0,
    ft: stats.filesTouchedCount || 0,
    ad: stats.activeDays || 0,
    to: Object.fromEntries(Object.entries(stats.tools || {}).sort((a,b) => b[1]-a[1]).slice(0, 8)),
    lg: Object.fromEntries(Object.entries(stats.languages || {}).sort((a,b) => b[1]-a[1]).slice(0, 8)),
    er: Object.fromEntries(Object.entries(stats.toolErrors || {}).sort((a,b) => b[1]-a[1]).slice(0, 6)),
    ha: stats.hourlyActivity || [],
    rt: bins,
    mrt: stats.median_response_time || 0,
    art: stats.avg_response_time || 0,
    mc: stats.multi_clauding || {},
    dr: stats.dateRange || {},
    ql: stats.qualitative || {}
  };

  if (stats.meta) {
    cleanStats.me = {
      qs: stats.meta.qualitativeSessionsAnalyzed,
      gt: stats.meta.generationTimeMs
    };
  }

  // 3. Synthesis Minification
  const minSy = {
    ag: synthesis.at_a_glance || {},
    pa: (synthesis.project_areas || []).slice(0, 5),
    is: synthesis.interaction_style || {},
    ww: synthesis.what_works || {},
    fa: synthesis.friction_analysis || {},
    su: synthesis.suggestions || {},
    oh: synthesis.on_the_horizon || {},
    fm: synthesis.notable_moment || synthesis.fun_moment
  };

  const embeddedData = { s: cleanStats, y: minSy };
  const jsonData = JSON.stringify(embeddedData);
  const compressed = zlib.gzipSync(jsonData);
  const base64Data = compressed.toString('base64');

  // Use docs/index.html as the single source of truth for the template
  const templatePath = path.join(__dirname, '..', '..', '..', 'docs', 'index.html');
  let html = fs.readFileSync(templatePath, 'utf8');
  
  // Inject the base64 data into the template
  html = html.replace('const EMBEDDED_DATA = "";', `const EMBEDDED_DATA = "${base64Data}";`);

  fs.writeFileSync(outputPath, html);
}

if (require.main === module) {
  const stats = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
  const synthesis = JSON.parse(fs.readFileSync(process.argv[3], 'utf8'));
  generate(stats, synthesis, process.argv[4]);
}
