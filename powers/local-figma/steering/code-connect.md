# Local Code Connect Steering

Use this steering when the user wants to map Figma components or instances to code components.

## Local Behavior

This local MCP does not read or write official Figma Code Connect backend mappings. It stores local Code Connect-style mappings in:

```text
.figma-mcp/code-connect-mappings.json
```

## Workflow

1. Use `get_code_connect_suggestions` to find component instances in the active Figma file.
2. Inspect the user's codebase for matching components.
3. Present likely matches if there is ambiguity.
4. Use `add_code_connect_map` or `send_code_connect_mappings` to save mappings.
5. Verify with `get_code_connect_map`.

## Mapping Fields

Use:

- `nodeId`
- `componentName`
- `source`
- `label`, usually `React`, `Vue`, `SwiftUI`, etc.

## Caveat

These mappings help local agents choose code components. They do not publish official Figma Code Connect data.
