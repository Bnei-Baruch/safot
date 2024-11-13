
# Safot Backend

A backend service built with FastAPI, Peewee ORM, and PostgreSQL for managing the Safot project. This service provides APIs for various functionalities and integrates with a PostgreSQL database.

## Table of Contents

- [Features](#features)
- [Technologies Used](#technologies-used)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Environment Setup](#environment-setup)
- [Usage](#usage)
- [Docker Setup](#docker-setup-optional)
- [Scripts](#scripts)
- [API Documentation](#api-documentation)
- [Contributing](#contributing)
- [License](#license)
- [Legacy Setup](#legacy-setup)

## Features

- Provides RESTful API endpoints for managing Safot project data.
- Database integration with PostgreSQL.
- Supports development, staging, and production environments.
- Lightweight and flexible with environment-based configurations.

## Technologies Used

- **Python** 3.11
- **FastAPI** - High-performance web framework for building APIs with Python.
- **Peewee** - Simple and small ORM for managing database operations.
- **PostgreSQL** - Database for robust data storage.
- **Uvicorn** - ASGI server for serving FastAPI applications.

## Prerequisites

- **Python** (>= 3.11)
- **pip** (Python package installer)
- **PostgreSQL** (Ensure it is running and accessible)
- **Git** (for cloning the repository)
- **Docker** (optional, for containerized deployment)

## Installation

1. **Clone the Repository**:
   ```bash
   git clone <repository-url>
   cd safot/backend
   ```

2. **Create and Activate a Virtual Environment**:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scriptsctivate
   ```

3. **Install Dependencies**:
   Run the setup script to install required Python packages and set up aliases for different environments:
   ```bash
   ./installreq.sh
   ```

4. **Set Up Database**:
   Ensure PostgreSQL is running, and update `.env` files with the correct database credentials.

## Environment Setup

This project uses environment-specific `.env` files:
- `.env.dev` - for development
- `.env.staging` - for staging
- `.env.prod` - for production

### Configuring Environment Variables
Each environment file (e.g., `.env.dev`, `.env.staging`, `.env.prod`) should contain the following variables:

```plaintext
PG_DATABASE=your_database_name  # Name of your PostgreSQL database
PG_USER=your_username           # Database user
PG_PASSWORD=your_password       # Password for the user
PG_HOST=localhost               # Database host, typically 'localhost' for local development
PG_PORT=5432                    # Standard PostgreSQL port
SECRET_KEY=your_secret_key      # Secret key for application security
```

These variables allow the application to connect to PostgreSQL and manage sensitive data securely across environments.

## Usage

### Start the Application

#### Development
```bash
rundev  # Starts with reload enabled
```

#### Staging
```bash
runstaging  # Starts with staging configuration
```

#### Production
```bash
runprod  # Starts with production configuration
```

> **Note**: These commands are available if you have run `installreq.sh` to set up aliases.

### API Documentation
FastAPI automatically generates interactive API documentation, which can be accessed at:
- **Swagger UI**: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
- **ReDoc**: [http://127.0.0.1:8000/redoc](http://127.0.0.1:8000/redoc)

## Docker Setup (Optional)

You can run the backend in a containerized environment using Docker and `docker-compose`, which simplifies setup and ensures consistency across environments.

### Prerequisites

- **Docker** - Install [Docker](https://docs.docker.com/get-docker/) if not already installed.
- **Docker Compose** - Install [Docker Compose](https://docs.docker.com/compose/install/) (often included with Docker Desktop).

### Build and Run with Docker Compose

1. **Update the `.env` Files**: Ensure the `.env` files (e.g., `.env.dev`, `.env.prod`) are correctly configured with database and application settings.

2. **Run Docker Compose for Development**:
   To run the development environment, you can use either of these options:
   
   - With `--env-file`:
     ```bash
     docker-compose --env-file .env.dev up --build
     ```
   
   - Using multiple compose files:
     ```bash
     docker-compose -f docker-compose.yml -f docker-compose.dev.yml up --build
     ```

   Both commands will use the `.env.dev` configuration, but the second approach allows you to apply development-specific overrides defined in `docker-compose.dev.yml`.

3. **Run Docker Compose for Production**:
   To run in production without overrides, you can simply use the base `docker-compose.yml`:
   ```bash
   docker-compose -f docker-compose.yml -f docker-compose.prod.yml up --build
   ```

4. **Verify the Server is Running**:
   Once the container is up, you can access the API at [http://localhost:8000](http://localhost:8000).

### Stopping the Containers

To stop and remove the containers, use:
```bash
docker-compose down
```

### Docker Compose Tips

- **Rebuild Images**: If you make changes to the code or dependencies, rebuild the images:
  ```bash
  docker-compose up --build
  ```
- **Detached Mode**: Run in the background by adding the `-d` flag:
  ```bash
  docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d
  ```

## Scripts

### `installreq.sh`
Automates the setup by installing dependencies and creating aliases for environment-specific startup commands.

### `run_dev.sh`, `run_staging.sh`, `run_prod.sh`
Scripts to load environment variables and start the server in development, staging, or production mode.

## Contributing

We welcome contributions! Please fork the repository, create a new branch, and submit a pull request with a detailed explanation of your changes.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for more information.

## Legacy Setup

For reference, here are the original commands used in setting up and starting the backend and frontend:

### Frontend
```bash
yarn install
PORT=1234 yarn start
```

### Backend
```bash
pip install "fastapi[standard]"
pip install python-docx
fastapi dev server.py --port=7392 --host=0.0.0.0
```
