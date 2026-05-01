# Security Policy

## Supported Versions

Security fixes are handled on the default branch until the project publishes versioned releases.

## Reporting a Vulnerability

Do not open a public issue for secrets, arbitrary code execution risks, or local network exposure bugs.

Report privately to the repository maintainers with:

- Affected version or commit.
- Reproduction steps.
- Impact.
- Suggested mitigation, if known.

## Local Security Model

Figma Local MCP is a local bridge:

- The MCP server listens on localhost for the Figma plugin bridge.
- The Figma plugin executes commands in the active Figma Desktop document.
- `use_figma` intentionally executes JavaScript provided by the connected MCP client.

Only run the bridge for IDE agents and repositories you trust.
