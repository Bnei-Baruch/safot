chmod +x run_dev.sh run_prod.sh run_staging.sh
set -a
source .env.staging
set +a
python server.py

# The  set -a  command tells the shell to export all variables to the environment.
# The  source .env.staging  command reads the environment variables from the  .env.staging  file.
# The  set +a  command tells the shell to stop exporting variables to the environment.
