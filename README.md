# ProjectFlow

ProjectFlow is a lightweight project and task tracker for software teams.
Organizations own projects, projects own tasks, and tasks carry a status, a
priority and a discussion thread.

It is a TypeScript monorepo: a NestJS + MongoDB API and a Next.js App Router
frontend, sharing a small package of domain types and enums.

---

## Technology stack

| Area         | Choice                                           |
| ------------ | ------------------------------------------------ |
| Monorepo     | pnpm workspaces + Turborepo                      |
| Language     | TypeScript 5.9                                   |
| API          | NestJS 11, Mongoose 8, MongoDB                   |
| Auth         | JWT bearer tokens, bcrypt password hashing       |
| Web          | Next.js 16 (App Router), React 19                |
| Styling      | Tailwind CSS 4, Radix primitives, Phosphor Icons |
| Server state | TanStack Query 5                                 |
| Forms        | React Hook Form + Zod                            |
| Testing      | Jest, Supertest, mongodb-memory-server           |

---

## Prerequisites

- **Node.js 20.19+** (22 or 24 recommended)
- **pnpm 10+** — `npm install -g pnpm`
- **MongoDB 7+** running locally

On macOS:

```bash
brew tap mongodb/brew
brew install mongodb-community@7.0
brew services start mongodb-community@7.0
```

Any reachable MongoDB works — point `MONGODB_URI` wherever you like.

---

## Installation

```bash
pnpm install
```

## Environment setup

Configuration lives in a single `.env` file at the repository root; both apps
read it.

```bash
cp .env.example .env
```

| Variable              | Purpose                          | Default                                 |
| --------------------- | -------------------------------- | --------------------------------------- |
| `MONGODB_URI`         | MongoDB connection string        | `mongodb://127.0.0.1:27017/projectflow` |
| `JWT_SECRET`          | Signing secret for access tokens | — (required)                            |
| `JWT_EXPIRES_IN`      | Access token lifetime            | `7d`                                    |
| `API_PORT`            | Port the API listens on          | `4732`                                  |
| `WEB_ORIGIN`          | Origin allowed by CORS           | `http://localhost:3742`                 |
| `NEXT_PUBLIC_API_URL` | API base URL used by the browser | `http://localhost:4732`                 |

The API refuses to boot if `MONGODB_URI` or `JWT_SECRET` is missing.

## Database

Make sure MongoDB is running, then load development data:

```bash
pnpm seed
```

The seed is repeatable — it clears the ProjectFlow collections and reinserts a
fresh organization, users, projects, tasks and comments.

## Running the apps

```bash
pnpm dev
```

- Web — <http://localhost:3742>
- API — <http://localhost:4732>

Both apps deliberately avoid the usual 3000/4000 defaults so they do not clash
with other projects. To move the web app, set `WEB_PORT` in your shell and
update `WEB_ORIGIN` in `.env` to match, so CORS keeps working:

```bash
WEB_PORT=3800 pnpm --filter @projectflow/web dev
```

The API port comes from `API_PORT` in `.env`; change `NEXT_PUBLIC_API_URL` to
match if you move it.

Run one at a time if you prefer:

```bash
pnpm --filter @projectflow/api dev
pnpm --filter @projectflow/web dev
```

## From a clean checkout

```bash
pnpm install
cp .env.example .env
pnpm seed
pnpm dev
```

---

## API Documentation (Swagger)

Interactive Swagger API documentation has been configured for the backend.

1. Ensure the development server is running (`pnpm dev`).
2. Navigate to: [http://localhost:4732/projectflow/api/docs](http://localhost:4732/projectflow/api/docs)

You can use the **Authorize** button at the top of the Swagger UI to inject a valid JWT Bearer token (obtained by calling the `/auth/login` endpoint or intercepting your browser network traffic) to test secured endpoints directly from the browser.

---

## Commands

| Command          | Description                                |
| ---------------- | ------------------------------------------ |
| `pnpm dev`       | Run the API and web app in watch mode      |
| `pnpm build`     | Build every package and app                |
| `pnpm lint`      | ESLint across the workspace                |
| `pnpm typecheck` | TypeScript project-wide, no emit           |
| `pnpm test`      | API test suite (uses an in-memory MongoDB) |
| `pnpm seed`      | Reset and reload development data          |
| `pnpm format`    | Prettier write                             |

`pnpm test` does not need a running MongoDB — it starts a throwaway in-memory
server for the duration of the run. The first run downloads a MongoDB binary
(around 100 MB) and caches it.

---

## Development credentials

Seeded accounts, all sharing the password `Password123!`:

| Name         | Email                 | Access                    |
| ------------ | --------------------- | ------------------------- |
| Ammar Yaser  | `ammar@example.com`   | Organization owner        |
| Sarah Ahmed  | `sarah@example.com`   | Organization admin        |
| Ahmed Hassan | `ahmed@example.com`   | Project manager on `ENG`  |
| Magd Ali     | `magd@example.com`    | Member of `ENG` and `WEB` |
| Outside User | `outside@example.com` | No organization           |

These are local development accounts only.

---

## Technical Decisions

During the development and stabilization of this project, several major architectural decisions were made:

1. **Atomic Sequences for Task Concurrency:** To prevent race conditions when multiple users create tasks simultaneously, task numbers are generated using a dedicated `project_sequences` collection with atomic `findOneAndUpdate` operations and a `{ unique: true }` compound index.
2. **Backend-For-Frontend (BFF) Hydration:** The Activity timeline hydrates user metadata (like assignee names) directly in the backend using batched queries (`$in`) instead of leaving the frontend to perform N+1 API calls.
3. **Cursor Pagination:** Standard offset pagination degrades quickly on large time-series datasets. The Activity timeline uses high-performance Cursor Pagination based on the MongoDB `_id` chronological sorting.
4. **Centralized Authorization Guarding:** To prevent Insecure Direct Object Reference (IDOR) vulnerabilities, all data access and mutation endpoints strictly pipe through `ProjectAccessService.assertCanView` or `assertCanManage`.

---

## Known Limitations

To adhere to the scope of the assessment, some features were intentionally left out as future improvements:

1. **JWT Storage:** JWT tokens are currently stored in `localStorage`. For production security against XSS attacks, this must be migrated to `HttpOnly` secure cookies.
2. **Caching & Message Queues:** As read/write volumes scale, the application will need a Redis caching layer for read-heavy routes and a background job queue (e.g., BullMQ) to process activity logs asynchronously.
3. **Cascading Deletions:** Deleting a task currently executes multiple independent operations via `Promise.all` rather than a MongoDB transactional session, risking orphaned records on failure. Furthermore, there is no API or UI to delete entire Projects.

---

## Documentation

The `docs/` folder contains deeper dives into specific areas of the project:

- **[AI_LOG.md](./docs/AI_LOG.md)** — A log of AI-assisted tasks and prompts used during development.
- **[ASSESSMENT_NOTES.md](./docs/ASSESSMENT_NOTES.md)** — Extensive notes on the original assessment requirements, planning, and implementation steps, code review exercise.
- **[BUG_REPORT.md](./docs/BUG_REPORT.md)** — Documentation of identified issues, debugging steps.
- **[DOCKER_ARCHITECTURE.md](./docs/DOCKER_ARCHITECTURE.md)** — In-depth explanation of the containerized setup, multi-stage builds, and deployment.
- **[SCALING_ACTIVITY_SYSTEM.md](./docs/SCALING_ACTIVITY_SYSTEM.md)** — Technical deep dive into the design decisions for building a high-performance Activity Timeline.

---

## Architecture

```
projectflow/
├── apps/
│   ├── api/                     NestJS API
│   │   ├── src/
│   │   │   ├── auth/            register / login / current user
│   │   │   ├── users/
│   │   │   ├── organizations/
│   │   │   ├── organization-members/
│   │   │   ├── projects/        projects + ProjectAccessService
│   │   │   ├── project-members/
│   │   │   ├── tasks/
│   │   │   ├── comments/
│   │   │   ├── common/          guards, decorators, filters, shared DTOs
│   │   │   └── database/seed.ts
│   │   └── test/                e2e suites and fixtures
│   │
│   └── web/                     Next.js App Router frontend
│       └── src/
│           ├── app/             routes and layouts
│           ├── components/      design system primitives + app shell
│           ├── features/        auth, projects, tasks, comments
│           ├── lib/             API client, query keys, formatting
│           └── providers/       TanStack Query provider
│
└── packages/
    ├── shared/                  enums, constants, API response types
    ├── eslint-config/           flat ESLint configs
    └── tsconfig/                base TypeScript configs
```

### API layering

Each module follows the same shape: controller → service → Mongoose model, with
DTOs validating input at the boundary. Controllers stay thin; business rules
live in services.

### Domain model

```
User
Organization        ── OrganizationMember ── User      (OWNER | ADMIN | MEMBER)
Organization  ── Project
Project             ── ProjectMember      ── User      (PROJECT_MANAGER | MEMBER)
Project       ── Task ── Comment
```

Membership is stored in its own collection rather than as arrays on the parent
document, so it can be indexed and queried directly. Both membership
collections carry a unique compound index on their two foreign keys.

Tasks are numbered per project and identified by a human-readable key derived
from the project key: `ENG-1`, `ENG-2`, `WEB-1`.

### Authorization

`ProjectAccessService` answers "may this user touch this project?" in one
place. Access comes from either an elevated organization role (`OWNER` or
`ADMIN`, which grants access to every project in the organization) or an
explicit project membership row. `assertCanView` gates reads, `assertCanManage`
gates configuration and membership changes.

Authentication is a JWT bearer token. `JwtAuthGuard` is registered globally;
routes opt out with the `@Public()` decorator.

### API surface

```
POST   /auth/register
POST   /auth/login
GET    /auth/me

GET    /organizations

GET    /projects
POST   /projects
GET    /projects/:projectId
GET    /projects/:projectId/members
POST   /projects/:projectId/members

GET    /projects/:projectId/tasks
POST   /projects/:projectId/tasks
GET    /tasks/:taskId
PATCH  /tasks/:taskId
PATCH  /tasks/:taskId/status
DELETE /tasks/:taskId

GET    /tasks/:taskId/comments
POST   /tasks/:taskId/comments
```

Errors share one shape:

```json
{
  "statusCode": 403,
  "message": "You do not have access to this project",
  "error": "Forbidden"
}
```

### Frontend

Routes are thin; the work happens in `features/`. Server state is owned by
TanStack Query — query keys live in `lib/query-keys.ts` so invalidation stays
predictable — and local UI state stays in React. The API client in
`lib/api-client.ts` centralises the base URL, the auth header and error
parsing.

Components are server components by default; `"use client"` is added only where
interactivity or hooks require it.
