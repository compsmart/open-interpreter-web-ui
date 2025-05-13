#!/usr/bin/env python
"""
Test script for OpenAI TTS functionality
"""
import os
import sys
from openai import OpenAI

def main():
    """Test OpenAI TTS functionality"""
    print("Testing OpenAI TTS API...")
    print(f"API Key starts with: {os.environ.get('OPENAI_API_KEY', 'Not set')[:4]}...")
    
    try:
        # Initialize OpenAI client
        client = OpenAI()
        
        # Generate speech
        print("Calling speech.create API...")
        response = client.audio.speech.create(
            model="tts-1",
            voice="alloy",
            input="This is a test of the text-to-speech API from OpenAI."
        )
        
        # Save to file
        output_file = "test_speech.mp3"
        response.stream_to_file(output_file)
        
        print(f"Speech saved to {output_file}")
        
        # Also print response headers and metadata
        print(f"Response type: {type(response)}")
        print(f"Content length: {len(response.content)} bytes")
        
        return True
    except Exception as e:
        print(f"Error testing TTS: {str(e)}", file=sys.stderr)
        import traceback
        traceback.print_exc(file=sys.stderr)
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
