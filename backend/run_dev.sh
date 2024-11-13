set -a
source .env.dev || { echo "Failed to load .env.dev"; exit 1; }
set +a
echo "Environment variables loaded from .env.dev"
uvicorn server:app --host 127.0.0.1 --port 8000 --reload

# The  set -a  command tells the shell to export all variables to the environment. 
# The  source .env.dev  command reads the environment variables from the  .env.dev  file. 
# The  set +a  command tells the shell to stop exporting variables to the environment. 
    