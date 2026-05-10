# Figma Plugin vs figma-local-mcp Comparison

## Architecture Differences

### Official Figma Plugin
- **Location**: `C:\Users\stylw\.claude\plugins\cache\claude-plugins-official\figma\2.1.30\`
- **MCP Server**: Remote HTTP server at `https://mcp.figma.com/mcp`
- **Connection**: Cloud-based, requires Figma account authentication
- **Limitations**: Rate limits, requires internet connection

### figma-local-mcp (Your Implementation)
- **Location**: `D:\Figma Plugin\figma-local-mcp\`
- **MCP Server**: Local WebSocket server (`mcp-server/server.js`)
- **Connection**: Direct connection to Figma Desktop app via plugin bridge
- **Advantages**: Unlimited usage, works offline, faster response times

---

## Tools Comparison

### ✅ Tools Already Implemented in Local MCP

Your local MCP **already has all the core tools**:

| Tool Name | Status | Description |
|-----------|--------|-------------|
| `get_metadata` | ✅ Implemented | Get sparse XML representation of nodes |
| `get_screenshot` | ✅ Implemented | Export PNG screenshots |
| `get_variable_defs` | ✅ Implemented | Get variables, styles, and bindings |
| `get_design_context` | ✅ Implemented | Get full design context with metadata + screenshot |
| `search_design_system` | ✅ Implemented | Search components, variables, styles |
| `create_design_system_rules` | ✅ Implemented | Generate implementation rules |
| `get_code_connect_map` | ✅ Implemented | Retrieve Code Connect mappings |
| `add_code_connect_map` | ✅ Implemented | Add Code Connect mappings |
| `get_code_connect_suggestions` | ✅ Implemented | Suggest Code Connect mappings |
| `send_code_connect_mappings` | ✅ Implemented | Save Code Connect mappings |
| `get_figjam` | ✅ Implemented | Get FigJam board metadata |
| `generate_diagram` | ✅ Implemented | Generate diagrams from Mermaid |
| `generate_figma_design` | ✅ Implemented | Create Figma layers from HTML/URL |
| `create_new_file` | ✅ Implemented | Create new pages |
| `whoami` | ✅ Implemented | Get MCP identity info |
| `use_figma` | ✅ Implemented | Execute JavaScript in Figma |

**Conclusion**: Your local MCP has **ALL** the tools that the official plugin uses.

---

## Skills Comparison

### Official Plugin Skills (9 total)

Located in: `C:\Users\stylw\.claude\plugins\cache\claude-plugins-official\figma\2.1.30\skills\`

1. ✅ `figma-use` - Guidance for using `use_figma` tool
2. ✅ `figma-implement-design` - Translate Figma designs to code
3. ❌ `figma-code-connect` - Create/maintain Code Connect files
4. ❌ `figma-create-design-system-rules` - Generate design system rules
5. ❌ `figma-generate-design` - Build full pages in Figma from code
6. ❌ `figma-generate-diagram` - Create diagrams in Figma
7. ❌ `figma-generate-library` - Build design systems in Figma
8. ✅ `figma-use-figjam` - FigJam-specific guidance
9. ❌ `generate-project-plan` (workflow-skills/) - Project planning

### Local MCP Skills (3 total)

Located in: `D:\Figma Plugin\figma-local-mcp\skills\`

1. ✅ `local-figma-implement-design`
2. ✅ `local-figma-use`
3. ✅ `local-figma-use-figjam`

### ❌ Missing Skills (6 skills)

These skills are **missing** from your local MCP:

1. `figma-code-connect`
2. `figma-create-design-system-rules`
3. `figma-generate-design`
4. `figma-generate-diagram`
5. `figma-generate-library`
6. `generate-project-plan`

---

## How to Get All Skills in Your Local MCP

### Option 1: Copy Skills from Official Plugin (Recommended)

Copy the missing skills from the official plugin to your local MCP:

```bash
# Copy individual skills
cp -r "C:\Users\stylw\.claude\plugins\cache\claude-plugins-official\figma\2.1.30\skills\figma-code-connect" "D:\Figma Plugin\figma-local-mcp\skills\"

cp -r "C:\Users\stylw\.claude\plugins\cache\claude-plugins-official\figma\2.1.30\skills\figma-create-design-system-rules" "D:\Figma Plugin\figma-local-mcp\skills\"

cp -r "C:\Users\stylw\.claude\plugins\cache\claude-plugins-official\figma\2.1.30\skills\figma-generate-design" "D:\Figma Plugin\figma-local-mcp\skills\"

cp -r "C:\Users\stylw\.claude\plugins\cache\claude-plugins-official\figma\2.1.30\skills\figma-generate-diagram" "D:\Figma Plugin\figma-local-mcp\skills\"

cp -r "C:\Users\stylw\.claude\plugins\cache\claude-plugins-official\figma\2.1.30\skills\figma-generate-library" "D:\Figma Plugin\figma-local-mcp\skills\"

cp -r "C:\Users\stylw\.claude\plugins\cache\claude-plugins-official\figma\2.1.30\workflow-skills\generate-project-plan" "D:\Figma Plugin\figma-local-mcp\skills\"
```

### Option 2: Update Skill References

After copying, you may need to update skill references to use your local MCP tool names:

- Official tools: `mcp__figma__tool_name`
- Local tools: `mcp__figma-local-mcp__tool_name`

The skills should work as-is since they reference generic tool names like `use_figma`, `get_design_context`, etc.

---

## Key Advantages of Your Local MCP

1. **Unlimited Usage** - No rate limits or API quotas
2. **Offline Capable** - Works without internet connection
3. **Faster** - Direct connection to Figma Desktop, no network latency
4. **Privacy** - All data stays local, nothing sent to cloud
5. **Customizable** - You control the server code and can add features

---

## Next Steps

1. Copy the missing skills from the official plugin
2. Test that skills work with your local MCP tools
3. Update any skill references if needed (unlikely)
4. Reload plugins in Claude Code: `/reload-plugins`

Your local MCP will then have **feature parity** with the official plugin, but with unlimited local access!
