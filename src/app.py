import os
import uuid
import requests
from flask import Flask, render_template, request, jsonify, Response
from interpreter import interpreter
import json
import threading
import queue
import sys

app = Flask(__name__)

# Queue for storing messages from interpreter
message_queue = queue.Queue()

# Configure the interpreter
interpreter.auto_run = True  # Auto-run code without confirmation
interpreter.llm.model = "gpt-4"  # Default model, can be changed through UI

@app.route('/')
def index():
    """Render the main chat interface"""
    return render_template('index.html')
    
@app.route('/tts-test')
def tts_test():
    """Render the TTS test page"""
    return render_template('tts_test.html')

@app.route('/settings', methods=['GET', 'POST'])
def settings():
    """Handle settings update"""
    if request.method == 'POST':
        data = request.json
          # Update model settings
        model = data.get('model')
        if model:
            interpreter.llm.model = model
            custom = data.get('custom')
            # Handle custom models
            if custom:
                    interpreter.llm.model = 'openai/' + model  # Set model to custom'
                    interpreter.llm.offline = True
                    # get LOCAL_MODEL_API_BASE from environment variable
                    local_api_base = os.environ.get('LOCAL_MODEL_API_BASE')
                    interpreter.llm.api_base = local_api_base 
                    interpreter.llm.format = "openai"  # Configure chat format for OpenAI compatibility
                    print(f"Using custom model API base: {local_api_base}", file=sys.stderr)
            else:
                # Reset to default API base for hosted models
                interpreter.llm.api_base = None
                interpreter.llm.offline = False
        
        # Update context window if provided
        context_window = data.get('context_window')
        if context_window and str(context_window).isdigit():
            interpreter.llm.context_window = int(context_window)
            
        # Update max tokens if provided
        max_tokens = data.get('max_tokens')
        if max_tokens and str(max_tokens).isdigit():
            interpreter.llm.max_tokens = int(max_tokens)
              # Update auto_run setting
        auto_run = data.get('auto_run')
        if auto_run is not None:
            interpreter.auto_run = auto_run
            
        return jsonify({"success": True})
    
    # Return current settings
    settings = {
        "model": interpreter.llm.model,
        "context_window": interpreter.llm.context_window,
        "max_tokens": interpreter.llm.max_tokens,
        "auto_run": interpreter.auto_run
    }
    
    # Add API base URL if it's set (for local models)
    if hasattr(interpreter.llm, 'api_base') and interpreter.llm.api_base:
        settings['api_base'] = interpreter.llm.api_base
    else:
        settings['api_base'] = os.environ.get('LOCAL_MODEL_API_BASE', 'http://192.168.1.118:1234/v1')
    
    # Add API base URL if it's set (for local models)
    if hasattr(interpreter.llm, 'api_base') and interpreter.llm.api_base:
        settings['api_base'] = interpreter.llm.api_base
    else:
        settings['api_base'] = os.environ.get('LOCAL_MODEL_API_BASE', 'http://localhost:1234/v1')
    
    return jsonify(settings)

@app.route('/chat', methods=['POST'])
def chat():
    """Process a chat message and return the response as a stream"""
    data = request.json
    prompt = data.get('prompt')
    
    if not prompt:
        return jsonify({"error": "No prompt provided"}), 400
    
    # Generate a unique session ID for this chat
    session_id = str(uuid.uuid4())
    print(f"Starting chat session {session_id} with prompt: {prompt}", file=sys.stderr)
    
    # Clear the queue before starting a new chat
    while not message_queue.empty():
        message_queue.get()
    
    # Start a new thread for processing the chat
    threading.Thread(target=process_chat, args=(prompt,)).start()
    
    # Return the streaming response
    return Response(stream_messages(), mimetype='text/event-stream')

def process_chat(prompt):
    """Process the chat in a separate thread"""
    try:
        print(f"Processing chat with prompt: {prompt}", file=sys.stderr)
        
        # Import the utils modules for parsing interpreter chunks
        from utils.helpers import parse_interpreter_chunk
        from utils.message_handler import process_chunk_for_ui        # Track whether we're in a code block or message block
        in_code_block = False
        in_message_block = False
        had_code_execution = False
        code_execution_ended = False
        
        # Stream the chat response
        for chunk in interpreter.chat(prompt, stream=True, display=False):
            # Print chunk type for debugging
            print(f"Chunk type: {type(chunk)}, Content: {chunk}", file=sys.stderr)
            
            try:                # Parse the chunk into a standardized format
                processed_chunk = parse_interpreter_chunk(chunk)
                
                # Make sure code, console, and output chunks are properly marked
                if processed_chunk['type'] in ['code', 'console', 'output']:
                    processed_chunk['skip_chat'] = True
                
                # Add UI hints for the frontend
                enhanced_chunk = process_chunk_for_ui(processed_chunk)
                
                # Update our state tracking
                if enhanced_chunk['type'] == 'code' and enhanced_chunk.get('is_new_block'):
                    in_code_block = True
                    had_code_execution = True
                    code_execution_ended = False
                    # Make sure this is marked as a new element for the UI
                    enhanced_chunk['new_ui_element'] = True
                
                # If code block is ending, mark it and add a flag for the UI
                if enhanced_chunk['type'] == 'code' and enhanced_chunk.get('is_end'):
                    in_code_block = False
                    enhanced_chunk['code_block_completed'] = True # Explicit flag for UI
                
                # Track when output is ending too (indicates end of code execution)
                if enhanced_chunk['type'] == 'output' and enhanced_chunk.get('is_end'):
                    code_execution_ended = True
                
                # Handle message blocks
                if enhanced_chunk['type'] == 'message':
                    # Only set new_message_after_code if this is a truly new message after 
                    # complete code execution (end of code + end of output)
                    if had_code_execution and code_execution_ended:
                        enhanced_chunk['new_message_after_code'] = True
                        had_code_execution = False  # Reset the flag
                        code_execution_ended = False # Reset the flag
                    
                    if enhanced_chunk.get('is_new_block'):
                        in_message_block = True
                
                # Send the enhanced chunk to the frontend
                message_queue.put(enhanced_chunk)
            except Exception as chunk_error:
                print(f"Error processing chunk: {str(chunk_error)}", file=sys.stderr)
                # If parsing fails, still try to send something useful
                if isinstance(chunk, dict):
                    message_queue.put(chunk)
                elif isinstance(chunk, str):
                    message_queue.put({"type": "message", "content": chunk})
                else:
                    message_queue.put({"type": "message", "content": str(chunk)})
                
    except Exception as e:
        import traceback
        print(f"Error in process_chat: {str(e)}", file=sys.stderr)
        traceback.print_exc(file=sys.stderr)
        message_queue.put({"type": "error", "content": str(e)})
    finally:
        # Signal that we're done
        message_queue.put(None)

def stream_messages():
    """Stream messages from the queue as SSE events"""
    while True:
        try:
            chunk = message_queue.get()
            
            # None means we're done
            if chunk is None:
                yield "data: [DONE]\n\n"
                break
                
            # Convert the chunk to a proper format for SSE
            if isinstance(chunk, dict):
                # Already a dictionary, convert to JSON
                chunk_str = json.dumps(chunk)
            elif isinstance(chunk, str):
                # Try parsing as JSON in case it's already a JSON string
                try:
                    json.loads(chunk)  # Just to validate
                    chunk_str = chunk
                except json.JSONDecodeError:
                    # If not valid JSON, wrap it as a message
                    chunk_str = json.dumps({"type": "message", "content": chunk})
            else:
                # For any other type, convert to string and wrap as message
                chunk_str = json.dumps({"type": "message", "content": str(chunk)})
                
            yield f"data: {chunk_str}\n\n"
        except Exception as e:
            error_msg = json.dumps({"type": "error", "content": str(e)})
            yield f"data: {error_msg}\n\n"
            print(f"Error in stream_messages: {str(e)}", file=sys.stderr)

@app.route('/reset', methods=['POST'])
def reset():
    """Reset the interpreter's state"""
    interpreter.messages = []
    return jsonify({"success": True})

@app.route('/reset_from_index', methods=['POST'])
def reset_from_index():
    """Reset the interpreter's state from a specific message index"""
    try:
        data = request.json
        message_index = data.get('message_index')
        
        print(f"Resetting conversation from index: {message_index}", file=sys.stderr)
        print(f"Current messages count: {len(interpreter.messages)}", file=sys.stderr)
        
        if message_index is None:
            return jsonify({"error": "No message index provided"}), 400
        
        # Handle negative indexes (e.g., -1 to reset everything)
        if message_index < 0:
            interpreter.messages = []
            print("Reset all messages due to negative index", file=sys.stderr)
            return jsonify({"success": True, "remaining_messages": 0})
        
        # Keep messages up to (and including) the specified index
        if len(interpreter.messages) > 0:
            # Ensure the index is valid
            valid_index = min(message_index, len(interpreter.messages) - 1)
            
            # Keep only messages up to the specified index
            interpreter.messages = interpreter.messages[:valid_index+1]
            print(f"Kept messages up to index {valid_index}, new count: {len(interpreter.messages)}", file=sys.stderr)
            
            # Print kept messages for debugging
            if len(interpreter.messages) > 0:
                for i, msg in enumerate(interpreter.messages):
                    role = msg.get('role', 'unknown')
                    content_preview = str(msg.get('content', ''))[:50] + ('...' if len(str(msg.get('content', ''))) > 50 else '')
                    print(f"Message {i}: role={role}, content={content_preview}", file=sys.stderr)
            
            return jsonify({
                "success": True, 
                "remaining_messages": len(interpreter.messages),
                "last_message_role": interpreter.messages[-1].get('role') if interpreter.messages else None
            })
        else:
            # If no messages, reset everything
            interpreter.messages = []
            print("Reset all messages (empty message list)", file=sys.stderr)
            return jsonify({"success": True, "remaining_messages": 0})
    except Exception as e:
        import traceback
        print(f"Error in reset_from_index: {str(e)}", file=sys.stderr)
        traceback.print_exc(file=sys.stderr)
        return jsonify({"error": str(e), "traceback": traceback.format_exc()}), 500

@app.route('/history', methods=['GET'])
def history():
    """Get the chat history"""
    return jsonify(interpreter.messages)

@app.route('/api/models', methods=['GET'])
def get_models():
    """Fetch available models from the API"""
    try:
        api_base = request.args.get('api_base', os.environ.get('LOCAL_MODEL_API_BASE', 'http://192.168.1.118:1234/v1'))
        
        # Make sure api_base ends with /v1
        if not api_base.endswith('/v1'):
            api_base = api_base.rstrip('/') + '/v1'
            
        # Request models from the API
        response = requests.get(f"{api_base}/models")
        
        if response.status_code == 200:
            return jsonify(response.json())
        else:
            return jsonify({'error': f"Failed to fetch models: {response.status_code}"}), 500
    except Exception as e:
        return jsonify({'error': f"Error fetching models: {str(e)}"}), 500
        
@app.route('/api/text-to-speech', methods=['POST'])
def text_to_speech():
    """Convert text to speech using OpenAI API"""
    try:
        print(f"[TTS] Text-to-speech API called", file=sys.stderr)
        
        data = request.json
        text = data.get('text')
        voice = data.get('voice', 'alloy')  # Default voice
        
        print(f"[TTS] Request data - Voice: {voice}, Text: '{text[:50]}...'", file=sys.stderr)
        
        if not text:
            print(f"[TTS] Error: No text provided", file=sys.stderr)
            return jsonify({'error': 'No text provided'}), 400
            
        # Import OpenAI
        from openai import OpenAI
        import base64
        import os
        import time
        import tempfile
        
        # Generate a unique filename for debugging
        debug_file = os.path.join(tempfile.gettempdir(), f"tts_debug_{int(time.time())}.mp3")
        
        # Check for API key
        api_key = os.environ.get('OPENAI_API_KEY')
        if not api_key:
            print(f"[TTS] Warning: No OPENAI_API_KEY found in environment variables", file=sys.stderr)
            return jsonify({'error': 'OpenAI API key not configured', 'success': False}), 500
        else:
            print(f"[TTS] Found OPENAI_API_KEY in environment variables (first few chars): {api_key[:4]}...", file=sys.stderr)
        
        # Initialize OpenAI client
        try:
            print(f"[TTS] Initializing OpenAI client", file=sys.stderr)
            client = OpenAI()
            
            # Generate speech
            print(f"[TTS] Calling OpenAI TTS API with model: tts-1, voice: {voice}", file=sys.stderr)
            start_time = time.time()
            response = client.audio.speech.create(
                model="tts-1",
                voice=voice,
                input=text
            )
            
            # Log timing
            duration = time.time() - start_time
            print(f"[TTS] API call completed in {duration:.2f} seconds", file=sys.stderr)
            
            # Save to debug file
            try:
                response.stream_to_file(debug_file)
                print(f"[TTS] Debug audio saved to {debug_file}", file=sys.stderr)
                print(f"[TTS] File size: {os.path.getsize(debug_file)} bytes", file=sys.stderr)
            except Exception as save_error:
                print(f"[TTS] Error saving debug file: {str(save_error)}", file=sys.stderr)
            
            # Get audio data as base64
            print(f"[TTS] Converting response to base64", file=sys.stderr)
            audio_data = base64.b64encode(response.content).decode('utf-8')
            print(f"[TTS] Successfully generated audio data (length: {len(audio_data)})", file=sys.stderr)
            
            # Return success response
            print(f"[TTS] Returning success response with audio data", file=sys.stderr)
            return jsonify({
                'success': True,
                'audio': audio_data,
                'debug_file': debug_file
            })
        except Exception as inner_e:
            print(f"[TTS] Error during API call: {str(inner_e)}", file=sys.stderr)
            return jsonify({'error': str(inner_e), 'success': False}), 500
            
    except Exception as e:
        import traceback
        print(f"[TTS] Error in text-to-speech: {str(e)}", file=sys.stderr)
        traceback.print_exc(file=sys.stderr)
        return jsonify({'error': str(e), 'success': False}), 500        
        traceback.print_exc(file=sys.stderr)
        return jsonify({'error': str(e)}), 500

@app.route('/api/text-to-speech-orpheus', methods=['POST'])
def text_to_speech_orpheus():
    """Convert text to speech using Orpheus local API"""
    try:
        print(f"[TTS-Orpheus] Text-to-speech API called", file=sys.stderr)
        
        data = request.json
        text = data.get('text')
        voice = data.get('voice', 'tara')  # Default voice for Orpheus
        
        print(f"[TTS-Orpheus] Request data - Voice: {voice}, Text: '{text[:50]}...'", file=sys.stderr)
        
        if not text:
            print(f"[TTS-Orpheus] Error: No text provided", file=sys.stderr)
            return jsonify({'error': 'No text provided'}), 400
            
        import requests
        import base64
        import os
        import time
        import tempfile
        
        # Generate a unique filename for debugging
        debug_file = os.path.join(tempfile.gettempdir(), f"tts_orpheus_debug_{int(time.time())}.mp3")
          # Get local API base URL
        api_base = os.environ.get('ORPEUS_MODEL_API_BASE', 'http://127.0.0.1:5005')
        
        # Make sure api_base doesn't have trailing slash
        api_base = api_base.rstrip('/')
            
        orpheus_url = f"{api_base}/v1/audio/speech"
        print(f"[TTS-Orpheus] Using Orpheus endpoint: {orpheus_url}", file=sys.stderr)
        
        # Prepare payload for Orpheus
        payload = {
            "input": text,
            "model": "orpheus-3b-0.1-ft",
            "voice": "tara",
            "response_format": "wav",
            "speed": 1
        }

        
        try:
            # Call Orpheus TTS API
            print(f"[TTS-Orpheus] Calling Orpheus TTS API with voice: {voice}", file=sys.stderr)
            start_time = time.time()
            response = requests.post(orpheus_url, json=payload)
            
            # Log timing and check response status
            duration = time.time() - start_time
            print(f"[TTS-Orpheus] API call completed in {duration:.2f} seconds", file=sys.stderr)
            print(f"[TTS-Orpheus] Status code: {response.status_code}", file=sys.stderr)
            
            if response.status_code != 200:
                error_msg = f"Orpheus API returned error: {response.status_code}, {response.text}"
                print(f"[TTS-Orpheus] {error_msg}", file=sys.stderr)
                return jsonify({'error': error_msg, 'success': False}), response.status_code
            
            # Save to debug file
            try:
                with open(debug_file, 'wb') as f:
                    f.write(response.content)
                print(f"[TTS-Orpheus] Debug audio saved to {debug_file}", file=sys.stderr)
                print(f"[TTS-Orpheus] File size: {os.path.getsize(debug_file)} bytes", file=sys.stderr)
            except Exception as save_error:
                print(f"[TTS-Orpheus] Error saving debug file: {str(save_error)}", file=sys.stderr)
            
            # Get audio data as base64
            print(f"[TTS-Orpheus] Converting response to base64", file=sys.stderr)
            audio_data = base64.b64encode(response.content).decode('utf-8')
            print(f"[TTS-Orpheus] Successfully generated audio data (length: {len(audio_data)})", file=sys.stderr)
            
            # Return success response in the same format as OpenAI endpoint
            print(f"[TTS-Orpheus] Returning success response with audio data", file=sys.stderr)
            return jsonify({
                'success': True,
                'audio': audio_data,
                'debug_file': debug_file
            })
        except Exception as inner_e:
            print(f"[TTS-Orpheus] Error during API call: {str(inner_e)}", file=sys.stderr)
            return jsonify({'error': str(inner_e), 'success': False}), 500
            
    except Exception as e:
        import traceback
        print(f"[TTS-Orpheus] Error in text-to-speech-orpheus: {str(e)}", file=sys.stderr)
        traceback.print_exc(file=sys.stderr)
        return jsonify({'error': str(e), 'success': False}), 500
        
@app.route('/openai/completions', methods=['POST'])    
def completions():
    """Send prompt to openai completions endpoint"""
    from openai import OpenAI
    import os
    
    # Check for API key
    api_key = os.environ.get('OPENAI_API_KEY')
    if not api_key:
        print(f"[Completions] Warning: No OPENAI_API_KEY found in environment variables", file=sys.stderr)
        return jsonify({'error': 'OpenAI API key not configured', 'success': False}), 500
    else:
        print(f"[Completions] Found OPENAI_API_KEY in environment variables (first few chars): {api_key[:4]}...", file=sys.stderr)
        # Initialize OpenAI client
        try:
            data = request.json
            prompt = data.get('prompt')
            model = data.get('model', 'gpt-4o-mini')

            client = OpenAI(api_key=api_key)
            # Send prompt to completions endpoint
            response = client.completions.create(
                model=model,
                prompt=prompt,
                max_tokens=50
            )
            # Return the response
            return jsonify({
                'success': True,
                'response': response.choices[0].text.strip()
            })
        except Exception as e:
            print(f"[Completions] Error during API call: {str(e)}", file=sys.stderr)
            return jsonify({'error': str(e), 'success': False}), 500
        traceback.print_exc(file=sys.stderr)
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    # Default to port 5000 if not specified
    port = int(os.environ.get('PORT', 5000))
    host = os.environ.get('HOST', '0.0.0.0')
    
    # Check for OpenAI API key
    if not os.getenv('OPENAI_API_KEY'):
        print("\n" + "!"*60)
        print("WARNING: No OpenAI API key found in environment variables.")
        print("Many features will not work without an API key.")
        print("Please add your OpenAI API key to the .env file:")
        print("OPENAI_API_KEY=your_api_key_here")
        print("!"*60 + "\n")
    
    # Initialize API settings for local models
    default_model = os.environ.get('DEFAULT_MODEL', interpreter.llm.model)
    local_api_base = os.environ.get('LOCAL_MODEL_API_BASE')
    
    # Check if we're using a local model by default
    if default_model == 'local' and local_api_base:
        # Try to get the list of available models from the local API
        try:
            import requests
            models_response = requests.get(f"{local_api_base}/models", timeout=5)
            if models_response.status_code == 200:
                available_models = models_response.json().get('data', [])
                if available_models:
                    # Use the first available model as default
                    interpreter.llm.model = available_models[0]['id']
                    print(f"Found local models: {[m['id'] for m in available_models]}", file=sys.stderr)
                else:
                    interpreter.llm.model = "openai/custom"  # Generic model identifier
            else:
                interpreter.llm.model = "openai/custom"  # Generic model identifier
        except Exception as e:
            print(f"Error fetching local models: {str(e)}", file=sys.stderr)
            interpreter.llm.model = "openai/custom"  # Generic model identifier
        
        # Set API base and format for local model
        interpreter.llm.offline = True
        interpreter.llm.api_base = local_api_base
        interpreter.llm.format = "openai"  # Configure chat format for OpenAI compatibility
        print(f"Using local model with API base: {local_api_base}", file=sys.stderr)
    
    # Print startup information
    print("\n" + "="*60)
    print(f"Open Interpreter Web Bridge is running!")
    print(f"Local URL: http://localhost:{port}")
    print(f"Network URL: http://{host}:{port} (if accessible on your network)")
    print(f"Current model: {interpreter.llm.model}")
    if hasattr(interpreter.llm, 'api_base') and interpreter.llm.api_base:
        print(f"API base: {interpreter.llm.api_base}")
    print(f"Auto-run code: {'Enabled' if interpreter.auto_run else 'Disabled'}")
    print("="*60)
    print("\nPress Ctrl+C to quit\n")
    # Start the Flask app
    app.run(host=host, port=port, debug=True)
