# Assessment Notes

## Architecture Overview

**1. How is the application structured, and what are the major modules?**
ProjectFlow is structured as a TypeScript monorepo using `pnpm` workspaces and Turborepo. It is divided into three main packages:
- `apps/api`: The backend API built with NestJS and Mongoose for MongoDB. Major modules include Authentication, Users, Organizations (and members), Projects (and members), Tasks, and Comments.
- `apps/web`: The frontend application built with React 19 and Next.js 16 (App Router). Major feature modules align with the backend (Auth, Projects, Tasks, Comments).
- `packages/shared`: A shared package containing domain types, enums (e.g., `TaskStatus`), and DTO shapes ensuring type safety across the network boundary.

**2. Where does business logic live?**
In the backend, business logic lives exclusively in the `@Injectable()` Services (e.g., `tasks.service.ts`, `projects.service.ts`), which are injected via NestJS's dependency injection container. The Controllers are kept extremely thin, acting only as HTTP request routers that delegate work to the services and return DTO-validated responses. The services orchestrate interactions with Mongoose models, ensuring consistent rules before writing to the database.

**3. How does the frontend talk to the backend, and how is server state handled?**
The frontend communicates with the backend via a centralized API client (`lib/api-client.ts`) which handles the base URL and automatically injects auth tokens. 
Server state is managed using **TanStack Query 5**. Query keys and fetching logic are abstracted into custom hooks inside the `features/` directory (e.g., `features/tasks/hooks.ts`), keeping React components focused strictly on presentation rather than data fetching. 
*Note:* The current implementation relies primarily on `onSuccess` cache invalidations rather than optimistic updates, which means the UI only updates after the server responds.

**4. How are authentication and authorization implemented?**
- **Authentication**: Handled via JWT bearer tokens and `bcrypt` password hashing. A global `JwtAuthGuard` secures API routes by default unless explicitly decorated with `@Public()`.
- **Authorization**: Centralized within the backend's `ProjectAccessService`. It evaluates a user's permissions by checking both organization-level roles (e.g., `OWNER`, `ADMIN` grant blanket access) and explicit project-level memberships (e.g., `PROJECT_MANAGER`, `MEMBER`).

**5. How are the main entities related?**
- **Many-to-Many (User ↔ Organization)**: A User can belong to multiple Organizations, and an Organization has many Users. This is handled via an intermediate `OrganizationMember` document (storing their user ID, org ID, and role).
- **One-to-Many (Organization → Project)**: An Organization contains many Projects, but a Project belongs to exactly one Organization.
- **Many-to-Many (User ↔ Project)**: A User can be assigned to multiple Projects, and a Project has many Users. This is handled via an intermediate `ProjectMember` document.
- **One-to-Many (Project → Task)**: A Project contains many Tasks, but a Task belongs to exactly one Project.
- **One-to-Many (Task → Comment)**: A Task contains many Comments, but a Comment belongs to exactly one Task.
Crucially, instead of using arrays of ObjectIds on the parent document (which is a common MongoDB anti-pattern that leads to unbound array growth), relationships like memberships are stored in their own collections (`organization_members`, `project_members`). These collections use compound indexes (`{ projectId: 1, userId: 1 }`) for fast lookups. Similarly, Tasks belong to a Project via a `projectId` reference, and are sequentially numbered via a `number` field.

## Architectural Observations & Risks

### 1. Concurrent Task Creation (Race Condition)
- **Observation:** In `tasks.service.ts`, the `create` method generates task identifiers using `countDocuments() + 1`. 
- **Risk:** This approach is fundamentally not thread-safe. If two concurrent requests create a task in the same project, both will read the same count and assign the exact same `number` and `key` (e.g., `ENG-101`), leading to duplicate identifiers.
- **Action:** I will fix this immediately as requested in the brief. A safe solution involves using atomic database operations, such as a separate `sequences` collection with `findOneAndUpdate` and `$inc`.

### 2. Missing Authorization Check on Task Status Updates (Security)
- **Observation:** In `tasks.controller.ts`, the `PATCH /tasks/:taskId/status` endpoint does not retrieve the `@CurrentUser()` and passes no user context to `tasks.service.ts`'s `updateStatus` method. The service then updates the status without checking `projectAccessService`.
- **Risk:** This is a severe security vulnerability (Insecure Direct Object Reference / IDOR). Any authenticated user can modify the status of *any* task in the database, even if they aren't a member of the organization or project, simply by knowing the task's ID. This directly aligns with the reported production bug.
- **Action:** I will fix this immediately by enforcing the same `assertCanView` (and edit permission logic) used in the standard `update` method.

### 3. Non-Transactional Multi-Document Updates (Data Consistency)
- **Observation:** When deleting a task (`tasks.service.ts -> remove`), the code runs `Promise.all([this.commentModel.deleteMany(...), task.deleteOne()])`. 
- **Risk:** Because these are separate database operations executed without a MongoDB transaction, if one operation fails (e.g., due to a network blip), the database could be left in an inconsistent state (e.g., orphaned comments for a deleted task, or a task that couldn't be deleted despite its comments being wiped).
- **Action:** I will note this as a future improvement. While not catastrophic for a lightweight system, introducing MongoDB Sessions and Transactions for multi-document operations would greatly improve data consistency as the application scales.

### 4. JWT Stored in LocalStorage (Security)
- **Observation:** In `apps/web/src/lib/auth-storage.ts`, the application stores the JWT bearer token directly in `window.localStorage`.
- **Risk:** Storing authentication tokens in localStorage makes the application highly vulnerable to Cross-Site Scripting (XSS) attacks. If any malicious JavaScript is executed on the page, it can read `localStorage` and steal the user's active token.
- **Action:** A more secure architecture would rely on an `httpOnly`, `Secure` cookie set by the backend, which is invisible to frontend JavaScript.

### 5. Lack of Optimistic Updates for Task Mutations (UX / Performance)
- **Observation:** In `apps/web/src/features/tasks/hooks.ts`, the `useUpdateTaskStatus` hook relies on the `onSuccess` callback to invalidate the query and refresh the UI.
- **Risk:** While functionally correct, this degrades the user experience for a project management tool. Changing a task status requires waiting for the network round-trip before the UI reflects the change, making the application feel sluggish or unresponsive. 
- **Action:** I will implement optimistic updates for the new Task Assignment feature, where the UI updates immediately and rolls back if the server request fails.

### 6. Pagination & Data Growth for Activity System (Scaling)
- **Observation:** Activity logs (like task assignment changes) will grow linearly and much faster than the tasks themselves. 
- **Risk:** Standard offset pagination (`skip` and `limit`) becomes extremely slow on large collections because the database must scan and skip all previous documents before returning the requested page.
- **Action:** I will ensure the new Activity API design takes this into account. For true scale, a cursor-based pagination strategy paired with robust indexing would be necessary.
### 7. Missing Registration UI (UX / Completeness)
- **Observation:** The backend API has a fully functional `POST /auth/register` endpoint, but the frontend (`apps/web/src/app`) only contains a `/login` page and lacks a corresponding Registration UI. 
- **Risk:** New users cannot naturally onboard into the platform without manual API intervention or database seeding, severely limiting the product's usability. Furthermore, newly registered users start with no default organization or project roles, meaning a complete onboarding flow (Create User → Create/Join Organization) must be designed.
- **Action:** For the scope of this assessment, this is noted as an intentional omission. In a production environment, building out the `RegisterForm` component and the "Create Organization" onboarding flow would be an immediate priority.
### 8. Missing API Documentation (Developer Experience)
- **Observation:** There is no Swagger (OpenAPI) configuration or Postman collection provided for the NestJS backend. 
- **Risk:** In an API-first architecture, lacking interactive documentation severely degrades the developer experience. It makes it difficult for frontend engineers or third-party integrators to know what endpoints exist, what DTO payloads are required, and what responses to expect without manually reading the backend source code.
- **Action:** A standard improvement would be to install `@nestjs/swagger`, decorate the controllers and DTOs, and expose a `/api/docs` endpoint to auto-generate interactive API documentation.
### 9. Missing Caching Layer (Scaling)
- **Observation:** All read requests (like fetching the project details or task lists) currently hit the MongoDB database directly.
- **Risk:** While this is perfectly fine for 5,000 users, as the application scales towards 500,000 users, the database will bottleneck on heavily accessed endpoints, causing slow response times and high infrastructure costs.
- **Action:** A standard scaling improvement would be to introduce an in-memory cache like **Redis**. The best practice is to only cache data with a high read-to-write ratio (e.g., the first page of the Activity History or the Project Details). Crucially, an event-driven invalidation strategy must be implemented to delete the cache key whenever the underlying data is mutated (e.g., when a task is updated).

### 10. Missing Organization Member Management (UX / Completeness)
- **Observation:** The platform currently supports organizations, but there is no mechanism for an admin or owner to invite or add a new user to their organization. Both the API endpoint and the frontend UI for this are completely missing.
- **Risk:** Without the ability to add members to an organization, the core collaborative aspect of the platform is broken. Users are isolated and cannot work together across projects.
- **Action:** I will implement a new `POST /organizations/:id/members` endpoint on the backend to handle role assignments, and build an `AddMemberDialog` component in the frontend UI to allow elevated users to add new members.

### 11. Missing Create Project UI (UX / Completeness)
- **Observation:** The backend API has a fully functional `POST /projects` endpoint (and it successfully connects to `ProjectsService.create`), but the frontend is completely missing the UI to trigger this.
- **Risk:** Without a UI to create projects, users cannot initiate new workstreams without manual database seeding, breaking a core loop of the application.
- **Action:** I will build a `CreateProjectDialog` component for the frontend and integrate it into the `ProjectsView` page header, restricting it to users with an elevated organization role (`OWNER` or `ADMIN`).

## Structure & Layer Responsibility

```text
projectflow/
├── apps/
│   ├── api/                     # NestJS API
│   │   ├── src/
│   │   │   ├── auth/            # Authentication & session (JWT)
│   │   │   ├── users/           # User management
│   │   │   ├── organizations/   # Organizations & workspaces
│   │   │   ├── organization-members/
│   │   │   ├── projects/        # Project logic & ProjectAccessService
│   │   │   ├── project-members/ # Project membership
│   │   │   ├── tasks/           # Task management & statuses
│   │   │   ├── comments/        # Task discussions
│   │   │   ├── common/          # Shared guards, decorators, DTOs
│   │   │   └── database/seed.ts # Seeding script
│   │   └── test/                # e2e testing suites
│   │
│   └── web/                     # Next.js App Router Frontend
│       ├── src/
│       │   ├── app/             # App Router pages and layouts
│       │   ├── components/      # UI primitives (Radix, Tailwind)
│       │   ├── features/        # Feature logic (hooks, api, UI)
│       │   │   ├── auth/
│       │   │   ├── comments/
│       │   │   ├── projects/
│       │   │   └── tasks/
│       │   ├── lib/             # API client, query keys, auth storage
│       │   └── providers/       # TanStack Query & Context providers
│       └── package.json
│
└── packages/
    ├── shared/                  # Domain types, DTOs, and Enums
    ├── eslint-config/           # Centralized linting rules
    └── tsconfig/                # Base TypeScript configs
```

### Layer Responsibilities
- **Components**: Rendering UI and managing local, ephemeral state.
- **Hooks**: Abstracting server state, caching, and optimistic updates.
- **Controllers**: Parsing HTTP requests, enforcing input validation (DTOs), and returning responses.
- **Services**: The heart of the application, enforcing business rules, authorization checks, and orchestrating database calls.
- **Models**: Defining the shape, constraints, and indexes of the database collections.

## API Routes and Applied Services

| Route | Method | Applied Service | Responsibility |
|-------|--------|-----------------|----------------|
| `/auth/register` | `POST` | `AuthService` | Registers a new user |
| `/auth/login` | `POST` | `AuthService` | Authenticates and returns JWT |
| `/auth/me` | `GET` | `UsersService` | Fetches the current user profile |
| `/organizations` | `GET` | `OrganizationsService` | Lists user's organizations |
| `/projects` | `GET` | `ProjectsService` | Lists user's projects |
| `/projects` | `POST` | `ProjectsService` | Creates a new project |
| `/projects/:projectId` | `GET` | `ProjectsService` | Gets project details |
| `/projects/:projectId/members` | `GET`, `POST` | `ProjectMembersService` | Manages project members |
| `/projects/:projectId/tasks` | `GET`, `POST` | `TasksService` | Lists or creates project tasks |
| `/tasks/:taskId` | `GET`, `PATCH`, `DELETE` | `TasksService` | Fetches, updates, or deletes a task |
| `/tasks/:taskId/status` | `PATCH` | `TasksService` | Updates task status *(currently missing auth!)* |
| `/tasks/:taskId/comments` | `GET`, `POST` | `CommentsService` | Lists or adds task comments |

---
