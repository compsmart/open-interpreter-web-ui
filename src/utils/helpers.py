import json
import os
import re
import sys
from typing import Dict, Any, List, Optional, Union

def validate_input(user_input: str) -> str:
    """
    Validates user input to ensure it's a non-empty string
    
    Args:
        user_input: The user's input to validate
        
    Returns:
        The validated and stripped input string
        
    Raises:
        ValueError: If input is not a string or is empty
    """
    if not isinstance(user_input, str):
        raise ValueError("Input must be a string.")
    if len(user_input.strip()) == 0:
        raise ValueError("Input cannot be empty.")
    return user_input.strip()

def format_output(output: Any) -> str:
    """
    Formats different types of output to a string representation
    
    Args:
        output: The output to format
        
    Returns:
        A string representation of the output
    """
    if isinstance(output, str):
        return output
    elif isinstance(output, (list, dict)):
        return json.dumps(output, indent=2)
    else:
        return str(output)
        
def extract_code_blocks(markdown_text: str) -> List[Dict[str, str]]:
    """
    Extract code blocks from markdown text
    
    Args:
        markdown_text: Markdown text containing code blocks
        
    Returns:
        List of dictionaries with language and code content
    """
    code_blocks = []
    pattern = r'```(\w*)\n(.*?)```'
    matches = re.findall(pattern, markdown_text, re.DOTALL)
    
    for match in matches:
        language, code = match
        if not language:
            language = "text"
        code_blocks.append({
            "language": language,
            "code": code.strip()
        })
    
    return code_blocks

def load_environment_variables() -> Dict[str, str]:
    """
    Load environment variables needed for the application
    
    Returns:
        A dictionary of environment variables
    """
    env_vars = {}
    
    # API keys
    env_vars['OPENAI_API_KEY'] = os.getenv('OPENAI_API_KEY', '')
    env_vars['ANTHROPIC_API_KEY'] = os.getenv('ANTHROPIC_API_KEY', '')
    
    # Other settings
    env_vars['DEFAULT_MODEL'] = os.getenv('DEFAULT_MODEL', 'gpt-4')
    env_vars['CONTEXT_WINDOW'] = os.getenv('CONTEXT_WINDOW', '8000')
    env_vars['MAX_TOKENS'] = os.getenv('MAX_TOKENS', '1000')
    
    return env_vars

def parse_interpreter_chunk(chunk: Union[str, Dict[str, Any]]) -> Dict[str, Any]:
    """
    Parse chunk from OpenInterpreter's streaming response
    
    Args:
        chunk: The chunk from interpreter.chat() with stream=True
        
    Returns:
        Standardized dictionary with parsed content that controls UI behavior:
        - type: message, code, output, console, error, thinking_start, thinking_end
        - content: the actual content to display
        - is_new_block: whether this is the start of a new block (used for proper UI grouping)
        - is_end: whether this is the end of a block
        - language: for code chunks, the programming language
        - thinking: whether this is part of the thinking process
    """
    if isinstance(chunk, str):
        try:
            # Try parsing as JSON
            parsed = json.loads(chunk)
            return {
                "type": parsed.get("type", "message"),
                "content": parsed.get("content", chunk),
                "language": parsed.get("language", ""),
                "thinking": "<think>" in str(parsed.get("content", "")) or "</think>" in str(parsed.get("content", ""))
            }
        except json.JSONDecodeError:
            # If not valid JSON, treat as plain text message
            return {
                "type": "message",
                "content": chunk,
                "language": "",
                "thinking": "<think>" in chunk or "</think>" in chunk
            }
    elif isinstance(chunk, dict):
        # Extract role and check if this is a new section
        role = chunk.get("role", "assistant")
        chunk_type = chunk.get("type", "message")
        content = chunk.get("content", "")
        format_type = chunk.get("format", "")
      
        # Handle thinking tags for backwards compatibility
        if isinstance(content, str):
            is_thinking = "<think>" in content or "</think>" in content
            if is_thinking:
                if "<think>" == content.strip():
                    return {
                        "type": "thinking_start",
                        "content": "",
                        "language": "",
                        "thinking": True
                    }
                elif "</think>" == content.strip():
                    return {
                        "type": "thinking_end",
                        "content": "",
                        "language": "",
                        "thinking": True
                    }
        else:
            is_thinking = False
        
        # Check for start/end markers for sections
        is_start = chunk.get("start", False)
        is_end = chunk.get("end", False)
        
        # Process based on role and type
        if role == "assistant" and chunk_type == "code":
            # This is a code chunk from the assistant - should go to code panel
            return {
                "type": "code",
                "content": content,
                "language": format_type or chunk.get("language", ""),
                "is_new_block": is_start,
                "is_end": is_end
            }
        elif role == "computer" and chunk_type == "console":
            # This is output from code execution - should go to output panel
            if format_type == "output":
                return {
                    "type": "output",
                    "content": content,
                    "is_new_block": is_start,
                    "is_end": is_end
                }
            elif format_type == "active_line":
                # Active line indicator for code execution
                return {
                    "type": "console",
                    "format": "active_line",
                    "content": content,
                    "is_new_block": is_start,
                    "is_end": is_end
                }
            else:
                # Other console output
                return {
                    "type": "console",
                    "content": content,
                    "format": format_type,
                    "is_new_block": is_start,
                    "is_end": is_end
                }
        elif role == "assistant" and chunk_type == "message":
            # Regular message content - starts a new message block
            return {
                "type": "message",
                "content": content,
                "is_new_block": is_start,
                "is_end": is_end,
                "thinking": is_thinking if isinstance(content, str) else False
            }
        else:
            # Default handling for other types
            print(f"DEBUG: Unknown chunk format - role: {role}, type: {chunk_type}", file=sys.stderr)
            return {
                "type": chunk_type,
                "content": content,
                "role": role,
                "format": format_type,
                "is_new_block": is_start,
                "is_end": is_end,
                "thinking": is_thinking if isinstance(content, str) else False
            }
    else:
        return {
            "type": "error",
            "content": f"Unknown chunk type: {type(chunk)}",
            "language": "",
            "thinking": False
        }