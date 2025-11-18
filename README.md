# CLI Editor - AI-Powered Code Generation & Modification

A powerful CLI-based backend prototype that uses AI (GPT-4o Mini) to generate and modify code in existing repositories through natural language prompts.

## Architecture

```
┌─────────────┐      ┌──────────────┐      ┌─────────────┐
│             │      │              │      │             │
│  CLI Tool   │─────▶│ Express API  │─────▶│  Services   │
│             │      │              │      │             │
└─────────────┘      └──────────────┘      └─────────────┘
                            │                      │
                            ▼                      ▼
                     ┌──────────────┐      ┌─────────────┐
                     │              │      │             │
                     │   Database   │      │   Redis     │
                     │   (SQLite)   │      │   Cache     │
                     │              │      │             │
                     └──────────────┘      └─────────────┘
                            │
                            ▼
                     ┌──────────────┐
                     │              │
                     │   OpenAI     │
                     │ (GPT-4o Mini)│
                     │              │
                     └──────────────┘
```

## Tech Stack

### Backend

- **TypeScript** - Type-safe development
- **Express.js** - REST API server
- **SQLite** (better-sqlite3) - Database for persistence
- **Redis** (ioredis) - Session caching
- **JWT** - Token-based authentication
- **bcrypt** - Password hashing

### AI Integration

- **OpenAI SDK** - GPT-4o Mini for code generation

### CLI

- **Commander** - CLI framework
- **Prompts** - Interactive prompts
- **Ora** - Loading spinners
- **Chalk** - Colored terminal output

## Prerequisites

- Node.js 18+
- Redis server running locally
- OpenAI API key ([Get one here](https://platform.openai.com/api-keys))

## Installation

1. **Clone the repository**

   ```bash
   cd cli-editor-ai-assignment
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Start Redis** (if not already running)

   ```bash
   # macOS
   brew services start redis

   # Linux
   sudo systemctl start redis

   # Or use Docker
   docker run -d -p 6379:6379 redis
   ```

4. **Initialize the database**

   ```bash
   npm run db:migrate
   ```

5. **Build the project**
   ```bash
   npm run build
   ```

## Usage

### Starting the API Server

```bash
npm run dev
```

## Example Workflow

1. **Register and login**

   ```bash
   npm run cli register
   # Follow prompts
   ```

2. **Test with the sample repository**

   ```bash
   npm run cli run --repo ./sample-repo
   ```

3. **View the execution**
   The CLI will show:

   - Repository analysis
   - Relevant files identified
   - LLM-generated execution plan
   - Proposed modifications
   - File changes being applied
   - Execution summary

4. **Check the changes**
   ```bash
   cd sample-repo
   cat src/index.js  # View modified files
   ```

## API Endpoints

### Authentication

- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login
- `POST /api/auth/logout` - Logout
- `GET /api/auth/me` - Get current user

### Prompts

- `POST /api/prompts/execute` - Execute a prompt
- `GET /api/prompts/history` - Get prompt history
- `GET /api/prompts/:promptId` - Get prompt details

## Development

### Run in development mode

```bash
npm run dev
```

### Build for production

```bash
npm run build
npm start
```

### Database migration

```bash
npm run db:migrate
```
