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

> **Note**: This extension uses sub-agents to perform deep qualitative analysis. Sub-agent functionality is currently an **experimental feature** in Gemini CLI and must be enabled in your `settings.json`. Refer to the [Sub-agents Documentation](https://geminicli.com/docs/core/subagents/) for details on enabling the `experimental.enableAgents` flag.

> **Warning**: This extension may send a significant number of messages to Gemini to perform its analysis, which will consume your API quota. By using this extension, you acknowledge that you are solely responsible for any costs or quota usage incurred. The author is not responsible for any monetary loss or any actions/outcomes resulting from the execution of the agents.

Simply type the following command in any Gemini CLI session:

```bash
/insights
```

The command will walk you through a series of analysis passes. At the end, it will provide a link to the generated report: `file://${PWD}/gemini-insights.html`.

## How it Works

The extension uses a multi-pass orchestration engine (`skills/skill-synthesis-protocol/scripts/orchestrate.js`) that performs the following steps:

1.  **Aggregation**: Scans your local session logs (in `~/.gemini/tmp/`) to extract global quantitative metrics (tokens, tools, activity).
2.  **Qualitative Extraction**: Identifies the most significant sessions and uses the `agent-session-analyst` to extract "facets" (goals, outcomes, friction).
3.  **Global Synthesis**: Leverages the `skill-synthesis-protocol` to analyze all metrics and facets, producing a cohesive development coaching narrative.
4.  **Report Generation**: Compiles everything into a single HTML file with embedded, compressed data for easy sharing.

### Environment Variables

- `GEMINI_CLI_HOME`: Root directory for Gemini CLI configuration (defaults to `~`).
- `INSIGHTS_CACHE_DIR`: Location of the qualitative facets cache (defaults to `GEMINI_CLI_HOME/.gemini/cache/insights-extension`).
- `INSIGHTS_TEMP_DIR`: Location of the project-specific temporary processing directory (defaults to `GEMINI_CLI_HOME/.gemini/tmp/insights-extension/<project-hash>`).
- `GEMINI_SESSION_DIR`: Location of the Gemini CLI session logs (defaults to `GEMINI_CLI_HOME/.gemini/tmp`).

**Privacy Note**: To provide deep qualitative analysis, this extension samples message content from your sessions (typically the first and last few turns of each significant session). This data is processed locally by your Gemini CLI and is not shared with any third-party services beyond the Gemini API calls you authorize.
