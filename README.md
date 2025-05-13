# Open Interpreter Web Bridge

A user-friendly web GUI for interacting with the Open Interpreter AI agent.

## Features

- Modern, intuitive chat interface with real-time streaming responses
- Support for multiple language models (GPT-4, Claude, and local models)
- Run code directly from the chat interface with rich output formatting
- Configurable settings through the UI (model, context window, etc.)
- Support for both hosted and local models via API endpoints
- Markdown and code syntax highlighting for better readability

## Installation

1. Make sure you have Python 3.8+ installed
2. Install the Open Interpreter package:
```bash
pip install open-interpreter
```
3. Clone or download this repository:
```bash
git clone https://github.com/yourusername/open-interpreter-web-bridge.git
cd open-interpreter-web-bridge
```

2. Install the required dependencies:
```bash
pip install -r requirements.txt
```

3. Set up environment variables (optional):
Create a `.env` file in the project root with the following variables:
```
OPENAI_API_KEY=your_openai_api_key
ANTHROPIC_API_KEY=your_anthropic_api_key
DEFAULT_MODEL=gpt-4
```

## Usage

1. Start the web server:
```bash
python src/app.py
```

2. Open your browser and navigate to `http://localhost:5000`

3. Start chatting with Open Interpreter through the web interface

## Configuration

You can configure the web interface through the UI or by setting environment variables:

- **Model**: Choose between different AI models (GPT-4, Claude, etc.)
- **Context Window**: Set the maximum context size in tokens
- **Max Tokens**: Set the maximum number of tokens for the model response
- **Auto Run Code**: Toggle whether code should be executed automatically

## Command Line Options

You can also start the server with command line options:

```bash
python -m src --port 8000 --debug --host 127.0.0.1
```

## License

This project is licensed under the AGPL License - see the LICENSE file for details.

## Acknowledgements

- [Open Interpreter](https://github.com/OpenInterpreter/open-interpreter) - The core AI agent this project interfaces with
