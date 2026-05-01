# Official Figma MCP Compatibility

This project aims to match the official Figma MCP workflow where a local plugin can support it. It does not fully replace Figma's authenticated remote service.

## Close Matches

- `use_figma`: local JavaScript execution through the Figma Plugin API.
- `get_metadata`: sparse XML for selected/current nodes.
- `get_screenshot`: PNG export through `exportAsync`.
- `get_variable_defs`: local variables/styles and bound variable references.
- `get_figjam`: local FigJam metadata.
- `create_design_system_rules`: agent-facing guidance.

## Local Equivalents

- `get_design_context`: local metadata, node JSON, variables, and screenshot. Official remote MCP may return richer framework-oriented context.
- `search_design_system`: searches the active file only, not all team libraries.
- Code Connect tools: use local JSON mappings, not Figma's official Code Connect backend.
- `generate_diagram`: creates simple local editable diagram/source layers.
- `generate_figma_design`: creates simple editable layers from fetched HTML text, not a full browser-to-Figma capture pipeline.
- `create_new_file`: creates a new page in the active document.
- `whoami`: returns local user/server info.

## Unsupported Remote Semantics

The local server does not:

- Authenticate with Figma.
- Create new Figma drafts in a team or organization.
- Fetch arbitrary Figma file links from the cloud.
- Search remote team libraries.
- Read official Code Connect mappings from Figma's backend.
- Return Figma account, plan, or seat information.

## Agent Prompting Guidance

Prefer active-file language:

- "Use the selected frame in Figma."
- "Inspect the current Figma selection."
- "Create a new page in the active Figma file."

Avoid prompts that require remote semantics unless your MCP client also has the official Figma MCP server configured.

## Skill Compatibility

The local skills in this repo are adapted from the official workflow, but intentionally avoid claims that are only true for Figma's remote MCP:

- No remote file fetching from `fileKey`.
- No official Code Connect backend reads.
- No team library search.
- No authenticated Figma identity.
- No Figma draft creation.

Use local skills instead of the official skills when working only with this server.
