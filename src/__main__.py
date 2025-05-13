import os
import argparse
from app import app
from dotenv import load_dotenv

def main():
    """
    Main entry point for running the Open Interpreter Web Bridge
    """    # Load environment variables from parent directory's .env file
    load_dotenv(dotenv_path=os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '.env'))
    
    # Parse command line arguments
    parser = argparse.ArgumentParser(description='Open Interpreter Web Bridge')
    parser.add_argument('--port', type=int, default=5000, help='Port to run the server on')
    parser.add_argument('--debug', action='store_true', help='Run in debug mode')
    parser.add_argument('--host', type=str, default='0.0.0.0', help='Host to run the server on')
    args = parser.parse_args()
    
    # Print startup message
    print(f"Starting Open Interpreter Web Bridge on http://{args.host}:{args.port}")
    print("Press Ctrl+C to quit")
    
    # Start the Flask app
    app.run(host=args.host, port=args.port, debug=args.debug)

if __name__ == "__main__":
    main()
