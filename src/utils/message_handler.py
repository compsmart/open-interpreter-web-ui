"""
Helper module for message handling in the web bridge
"""
import sys
from typing import Dict, Any, Union

def process_chunk_for_ui(chunk: Dict[str, Any]) -> Dict[str, Any]:
    """
    Process a parsed chunk to provide appropriate UI instructions
    
    This function takes a parsed chunk from parse_interpreter_chunk and adds
    additional metadata to help the frontend determine how to render it.
    
    Args:
        chunk: The parsed chunk from parse_interpreter_chunk
        
    Returns:
        Enhanced chunk with UI instructions
    """
    # Track if this starts a new UI element
    chunk_type = chunk.get('type', '')
    
    # Code blocks should go to code panel only
    if chunk_type == 'code':
        # Ensure the code gets to the code panel
        return {
            **chunk,
            'panel': 'code',
            'skip_chat': True,  # Don't show code in the chat, only in code panel
            'new_message': chunk.get('is_new_block', False)
        }
        
    # Output should go to output panel only
    elif chunk_type == 'output':
        return {
            **chunk,
            'panel': 'output',
            'skip_chat': True,  # Don't show output in chat, only in output panel
            'new_message': False  # Output doesn't start a new message
        }
        
    # Console messages should go to output panel but not to chat
    elif chunk_type == 'console':
        return {
            **chunk,
            'panel': 'output',  # Send to output panel instead of chat
            'skip_chat': True,  # Don't show in chat at all
            'new_message': False
        }
        
    # Regular messages should create new message blocks when indicated
    elif chunk_type == 'message':
        return {
            **chunk,
            'panel': 'chat',
            'new_message': chunk.get('is_new_block', False)
        }
    
    # Default fallback for other types
    return {
        **chunk,
        'panel': 'chat',
        'new_message': chunk.get('is_new_block', False)
    }
