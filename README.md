# Insights Extension for Gemini CLI

This extension provides a powerful `/insights` command, inspired by the Claude Code feature of the same name. It analyzes your Gemini CLI usage patterns over the past 30 days and generates a comprehensive report with qualitative assessments and architectural suggestions.

## Features

- **Usage Analytics**: Aggregates token consumption, session duration, and tool usage frequency.
- **Language Detection**: Identifies programming languages based on file operations.
- **Git Activity**: Tracks Git-related workflows.
- **AI-Powered Analysis**: Submits metadata to Gemini for deep analysis of your coding habits and workflow efficiency.
- **Personalized Recommendations**: Provides actionable steps to optimize your use of MCP servers, skills, and agents.

## Installation

1. Clone this repository or download the source.
2. Link the extension locally:
   ```bash
   gemini extensions link /path/to/insights-extension
   ```

## Usage

Simply type the following command in any Gemini CLI session:

```bash
/insights
```

## How it Works

The extension uses a script (`scripts/aggregate-stats.js`) to scan your local session logs in `~/.gemini/tmp/`. It extracts metadata about your interactions, which is then formatted and passed back to Gemini. The model analyzes this data to provide a detailed report tailored to your recent activity.

**Note**: This extension only processes metadata (counts and file types) and does not send the full content of your messages to ensure privacy and efficiency.
