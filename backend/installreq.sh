# Step 1: Install Python dependencies
echo "Installing Python dependencies..."
pip install -r requirements.txt

# Check if pip install was successful
if [ $? -ne 0 ]; then
    echo "Error: Failed to install Python dependencies."
    exit 1
fi
echo "Python dependencies installed successfully."

# Step 2: Set up aliases
echo "Setting up aliases..."
bash setup_aliases.sh

echo "Setup complete. You can now use the 'rundev', 'runstaging', and 'runprod' commands."
