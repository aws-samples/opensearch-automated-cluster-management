#!/bin/bash

# Check if requirements.txt exists
if [ ! -f requirements.txt ]; then
  echo "Error: requirements.txt not found in the current directory."
  exit 1
fi

# Define the layer directory name
LAYER_DIR="python/lib/python3.12/site-packages"

# Create the layer directory structure
mkdir -p "$LAYER_DIR"

# Install the dependencies into the layer directory
python3.12 -m pip install -r requirements.txt -t "$LAYER_DIR"

# Check if the installation was successful
if [ $? -ne 0 ]; then
  echo "Error: Failed to install dependencies."
  exit 1
fi

echo "Lambda layer folder created successfully at $LAYER_DIR"

zip -r layer_content.zip python