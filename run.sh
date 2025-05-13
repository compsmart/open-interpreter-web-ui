#!/bin/bash

echo "================================================="
echo "      Starting Open Interpreter Web Bridge"  
echo "================================================="

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    echo "Error: Python 3 is not installed"
    echo "Please install Python 3.8 or newer"
    exit 1
fi

# Check if requirements are installed
if ! pip3 list | grep -q "open-interpreter"; then
    echo "Installing dependencies..."
    pip3 install -r requirements.txt
    if [ $? -ne 0 ]; then
        echo "Failed to install dependencies"
        exit 1
    fi
fi

# Start the server
echo "Starting server..."
cd src
python3 app.py
