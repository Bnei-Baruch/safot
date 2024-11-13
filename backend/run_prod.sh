set -a
source .env.prod
set +a
python server.py

# The  set -a  command tells the shell to export all variables to the environment.
# The  source .env.prod  command reads the environment variables from the  .env.prod  file.
# The  set +a  command tells the shell to stop exporting variables to the environment.
