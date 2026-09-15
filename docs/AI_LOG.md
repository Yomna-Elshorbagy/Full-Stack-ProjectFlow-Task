# AI Usage Documentation

### 01. Tools Used
- **Antigravity (Google Deepmind IDE Assistant)**: Used directly within the IDE as my primary pair-programming partner.
- **ChatGPT & Gemini**: Used as architectural sounding boards to deeply understand the structure of the Next.js / NestJS monorepo, to clarify the fundamental differences between React client-side rendering and Next.js server patterns, and to verify that my implementation plans correctly aligned with the strict assessment requirements before executing commits.

### 02. How I Used Them
- **Exploration & Architecture:** Asked the AI tools to deeply analyze the provided monorepo structure and validate my `implementation_plan.md` for handling hole phases first before dividing it into smaller tasks against best practices and understand the undocumented permission models.
- **Conceptual Validation:** Used ChatGPT/Gemini to ensure my strategy for sharing types (`@projectflow/shared`) across the Next.js frontend and NestJS backend was robust.
- **Debugging & Security:** Brainstormed potential root causes for the Concurrent Task Creation race condition and Insecure Direct Object Reference (IDOR) vulnerabilities.
- **Test Generation:** Relied on the AI to quickly scaffold the boilerplate for Supertest e2e tests based on the business rules checklist and all logic applied.

### 03. Suggestions I Rejected
**1. JWT Session Refactoring:** The AI strongly recommended rewriting the authentication system to use secure `HttpOnly` cookies with Access and Refresh tokens instead of storing raw JWTs in the browser, to prevent XSS attacks.
* **Why I Rejected It:** I completely agreed with the security principle, but I rejected the suggestion because it directly violated a core instruction of the assessment: *"Major architectural rewrites are not wanted. Extending the system consistently scores higher than replacing parts of it."* Rewriting the entire Auth module and Next.js fetch interceptors was out of scope, so I chose to adhere strictly to the brief while documenting the security observation.

**2. Activity Timeline Hydration:** The AI initially suggested fixing the Task Activity rendering by mapping the `assigneeId` entirely on the frontend using the local `useProjectMembers` cache. 
* **Why I Rejected It:** This approach was brittle. If a user is removed from an organization, their name would disappear from historical logs because they would no longer be in the active members array. Instead, I forced a complete Backend-for-Frontend (BFF) refactor (as documented in my `implementation_plan_Activity.md`), resolving all `from` and `to` user IDs on the backend via a batched query, ensuring the timeline remains a permanent, immutable ledger.

**3. Task Sequence Generation:** When investigating the assigned concurrency bug (where `countDocuments() + 1` was causing duplicate task IDs), the AI suggested fixing the race condition by wrapping the task insertion in a `while` loop that catches MongoDB `E11000` duplicate key errors and retries the count.
* **Why I Rejected It:** I rejected this because relying on exception handling and retry-loops for standard business logic is a heavy anti-pattern that causes massive database contention and performance degradation under load. Instead, I manually orchestrated a dedicated `Sequence` collection utilizing MongoDB's strictly atomic `findOneAndUpdate` with the `$inc` operator, backed by a `{ unique: true }` index for a bulletproof, lock-free solution.
### 04. Generated Code I Modified
**1. Task Assignment Business Logic**
The AI generated the initial `assignTask` business logic in `tasks.service.ts` to pass the assignment tests. 
* **What it produced:** It produced logic that correctly blocked outsiders from assigning tasks, which passed the explicitly stated negative test cases.
* **What was insufficient:** It completely failed to account for a critical unstated edge case: a project member should be allowed to assign *themselves* to an unassigned task.
* **What I changed & Why:** I manually intervened and updated the service logic to explicitly evaluate `const isAssigningSelf = dto.assigneeId === userId.toString();` and permitted the action if true. I then wrote an additional e2e test (`tasks.e2e.spec.ts`) to enforce this new self-assignment rule, proving that I don't just blindly accept AI-generated code without rigorously validating it against real-world UX expectations.

**2. Activity Timeline UI Formatting**
The AI generated the React component `task-activity-timeline.tsx` to display the hydrated activity logs on the frontend.
* **What it produced:** It produced a perfectly functional component, but it formatted the text generically (e.g., `'reassigned from X to Y'`).
* **What was insufficient:** The assessment brief explicitly mandated very specific phrasing (e.g., `'changed the assignee from themselves to [Name]'` or `'removed the assignee'`). The AI's generic phrasing failed to meet the strict UI spec.
* **What I changed & Why:** I modified the component's string interpolation logic to perfectly match the requested design language and edge cases, proving my strict attention to detail and adherence to product requirements.
