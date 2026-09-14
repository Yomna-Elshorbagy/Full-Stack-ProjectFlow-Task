# 1- Bug Report: Unauthorized Task Modification (IDOR)

## Description
A security vulnerability (Insecure Direct Object Reference) was found in the `PATCH /tasks/:taskId/status` endpoint. Any authenticated user could change the status of any task across the entire platform just by supplying a valid `taskId`, bypassing project access controls entirely.

## Root Cause
The `tasksService.updateStatus()` method only fetched the task and saved the new status. Unlike the `tasksService.update()` method, it completely omitted the `projectAccessService.assertCanView()` check, and did not verify if the user had `canManage` permissions or was the creator of the task.

## Resolution
1. **Controller Update**: Modified the `updateStatus` route in `tasks.controller.ts` to extract the `@CurrentUser('id')` and pass it to the service.
2. **Service Update**: Updated `tasksService.updateStatus()` to enforce `assertCanView(task.projectId, userId)`. Furthermore, it now enforces that only users with management roles (`OWNER`, `ADMIN`, `PROJECT_MANAGER`) or the original creator can edit the task status, bringing it in line with the main `update()` logic.
3. **Regression Tests**: Added an e2e test in `tasks.e2e.spec.ts` (`'refuses to update a task status for someone outside the project'`) which verifies that an outsider receives a `403 Forbidden` response.

---

# 2- Bug Report: Concurrent Task Creation Race Condition

## Description
Under high load, if multiple users created tasks in the same project simultaneously, the application would generate duplicate task numbers (e.g., two tasks with `ENG-101`), violating the unique identifier requirement.

## Root Cause
The `create` method in `tasks.service.ts` used `countDocuments({ projectId }) + 1` to determine the next task number. This read-modify-write approach is not atomic. In a concurrent scenario, two simultaneous requests would read the same document count and assign the same number before either was saved to the database.

## Resolution
1. **Sequence Collection**: Created a new `ProjectSequence` schema (`sequence.schema.ts`) to track the current task sequence number for each project.
2. **Atomic Increment**: Updated `tasks.service.ts` to use MongoDB's atomic `findOneAndUpdate` with the `$inc` operator. This guarantees that each task creation request increments the sequence atomically and returns a unique number, permanently resolving the race condition.
