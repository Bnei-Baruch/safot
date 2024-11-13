
# Safot Backend

A backend service built with FastAPI, Peewee ORM, and PostgreSQL for managing the Safot project. This service provides APIs for various functionalities and integrates with a PostgreSQL database.

## Table of Contents

- [Features](#features)
- [Technologies Used](#technologies-used)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Environment Setup](#environment-setup)
- [Usage](#usage)
- [Scripts](#scripts)
- [API Documentation](#api-documentation)
- [Contributing](#contributing)
- [License](#license)

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
   source venv/bin/activate  # On Windows: venv\Scripts\activate
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

## Scripts

### `installreq.sh`
Automates the setup by installing dependencies and creating aliases for environment-specific startup commands.

### `run_dev.sh`, `run_staging.sh`, `run_prod.sh`
Scripts to load environment variables and start the server in development, staging, or production mode.

## Contributing

We welcome contributions! Please fork the repository, create a new branch, and submit a pull request with a detailed explanation of your changes.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for more information.
