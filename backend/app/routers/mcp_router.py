import os
import sys
import json
from typing import Dict, Any, List
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.mcp_server import TOOLS, MCP_PROTOCOL_VERSION

router = APIRouter(prefix="/api/mcp", tags=["Model Context Protocol (MCP) Control"])

class ToggleToolRequest(BaseModel):
    tool_name: str
    enabled: bool

# In-memory tool state
tool_activation_state = {t["name"]: True for t in TOOLS}

@router.get("/status")
async def get_mcp_status():
    """Returns runtime MCP server status, protocol version, and active tool states."""
    active_tools = [t for t in TOOLS if tool_activation_state.get(t["name"], True)]
    return {
        "status": "ready",
        "protocol_version": MCP_PROTOCOL_VERSION,
        "total_tools": len(TOOLS),
        "enabled_tools_count": len(active_tools),
        "tools": [
            {
                "name": t["name"],
                "description": t["description"],
                "enabled": tool_activation_state.get(t["name"], True)
            }
            for t in TOOLS
        ]
    }

@router.post("/toggle")
async def toggle_mcp_tool(req: ToggleToolRequest):
    """Enable or disable an individual tool on the local MCP server."""
    if req.tool_name not in tool_activation_state:
        raise HTTPException(status_code=404, detail="Tool not found")
    tool_activation_state[req.tool_name] = req.enabled
    return {
        "status": "updated",
        "tool_name": req.tool_name,
        "enabled": req.enabled
    }

@router.get("/config")
async def get_claude_desktop_config():
    """Generates ready-to-copy Claude Desktop or Cursor MCP configuration snippet."""
    python_exe = sys.executable
    mcp_script = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "mcp_server.py"))
    
    config = {
        "mcpServers": {
            "researchloom": {
                "command": python_exe,
                "args": [mcp_script]
            }
        }
    }
    return {
        "config_json": json.dumps(config, indent=2),
        "install_instructions": "Add this block to %APPDATA%\\Claude\\claude_desktop_config.json to connect Claude directly to ResearchLoom."
    }
