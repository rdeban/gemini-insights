# Insights Extension for Gemini CLI

> **Initial Release**: This is an early, experimental version of the Insights extension. It is currently "rough around the edges," may not be perfect, and could underperform in certain scenarios. Feedback and contributions are welcome!

This extension provides a powerful `/insights` command, inspired by the Claude Code feature of the same name.
 It analyzes your Gemini CLI usage patterns over the past 30 days and generates a high-fidelity, interactive HTML report with qualitative assessments, development coaching, and architectural suggestions.

## Features

- **Multi-pass Orchestration**: Automatically runs a robust Node.js pipeline to aggregate, analyze, and synthesize data.
- **Deep Qualitative Analysis**: Uses a specialized `agent-session-analyst` to extract intent, friction, and outcomes from your session transcripts.
- **Development Coaching**: Provides a "narrative" of your interaction style, identifying what works and what's hindering your productivity.
- **Interactive HTML Report**: Generates a self-contained `gemini-insights.html` file with responsive charts, navigation, and portable sharing capabilities (via GZIP + Base64).
- **Usage Analytics**: Aggregates token consumption, session duration, tool usage frequency, and response time distributions.
- **Actionable Suggestions**: Recommends specific `GEMINI.md` additions and Gemini CLI features (MCP, Skills, etc.) based on your actual workflow.

## Installation

### From GitHub (Recommended)

To install the extension directly from GitHub without manually cloning:

```bash
gemini extensions install https://github.com/rdeban/gemini-insights
```

### Local Development

If you'd like to contribute or run a local version:

1. Clone this repository.
2. Link the extension from the project root:
   ```bash
   gemini extensions link .
   ```

## Usage

Simply type the following command in any Gemini CLI session:

```bash
/insights
```

### Modes

- **Standard (Default)**: Fast, "best-effort" qualitative analysis of your most significant recent sessions. The analysis is performed directly by the main Gemini agent.
- **Deep (`--deep`)**: Exhaustive analysis of up to 15 sessions using a specialized `agent-session-analyst` sub-agent. This provides more granular coaching and identifies more subtle friction patterns.

> **Note**: The `--deep` mode uses experimental sub-agents. This functionality must be enabled in your `settings.json`. Refer to the [Sub-agents Documentation](https://geminicli.com/docs/core/subagents/) for details on enabling the `experimental.enableAgents` flag. Standard mode does NOT require this flag.

> **Warning**: This extension, especially in `--deep` mode, may send a significant number of messages to Gemini to perform its analysis, which will consume your API quota. By using this extension, you acknowledge that you are solely responsible for any costs or quota usage incurred. The author is not responsible for any monetary loss or any actions/outcomes resulting from the execution of the agents.

## How it Works

The extension uses a multi-pass orchestration engine (`skills/skill-synthesis-protocol/scripts/orchestrate.js`) that performs the following steps:

1.  **Aggregation**: Scans your local session logs (in `~/.gemini/tmp/`) to extract global quantitative metrics (tokens, tools, activity).
2.  **Qualitative Extraction**: Identifies the most significant sessions and extracts "facets" (goals, outcomes, friction). In standard mode, this is a best-effort pass by the main agent; in `--deep` mode, it uses the specialized `agent-session-analyst` sub-agent.
3.  **Global Synthesis**: Leverages the `skill-synthesis-protocol` to analyze all metrics and facets, producing a cohesive development coaching narrative.
4.  **Report Generation**: Compiles everything into a single HTML file with embedded, compressed data for easy sharing.

### Environment Variables

- `GEMINI_CLI_HOME`: Root directory for Gemini CLI configuration (defaults to `~`).
- `INSIGHTS_CACHE_DIR`: Location of the qualitative facets cache (defaults to `GEMINI_CLI_HOME/.gemini/cache/insights-extension`).
- `INSIGHTS_TEMP_DIR`: Location of the project-specific temporary processing directory (defaults to `GEMINI_CLI_HOME/.gemini/tmp/insights-extension/<project-hash>`).
- `GEMINI_SESSION_DIR`: Location of the Gemini CLI session logs (defaults to `GEMINI_CLI_HOME/.gemini/tmp`).

**Privacy Note**: To provide qualitative analysis, this extension samples message content from your sessions (typically the first and last few turns of each significant session). This data is processed locally by your Gemini CLI and is not shared with any third-party services beyond the Gemini API calls you authorize.

## Troubleshooting & Cleanup

If the orchestration process gets stuck, or if you want to force a completely fresh analysis (including re-running the qualitative synthesis), you can clean up the extension's temporary and cache files.

### 1. Reset Current Project Analysis
To force the extension to re-calculate stats and re-synthesize the qualitative report for the current project, delete the temporary processing directory:

```bash
# Deletes temp data for ALL projects
rm -rf ~/.gemini/tmp/insights-extension/

# OR, if you want to be surgical, find your project hash in that directory and delete only it.
```

### 2. Clear Qualitative Cache
The extension caches qualitative "facets" (the analysis of individual sessions) to save time and API tokens. If you want to force the agent to re-analyze past sessions (e.g., after an update to the `agent-session-analyst`):

```bash
rm -rf ~/.gemini/cache/insights-extension/
```

### 3. Stuck Orchestration
If the `/insights` command tells you to "process the missing session facets" but you are unable to do so, deleting the `~/.gemini/tmp/insights-extension/` directory will reset the orchestration state.

