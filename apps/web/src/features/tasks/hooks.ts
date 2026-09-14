'use client';

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Paginated, ProjectMemberEntry, TaskDetail, TaskStatus, TaskSummary } from '@projectflow/shared';
import { queryKeys } from '@/lib/query-keys';
import {
  createTask,
  type CreateTaskPayload,
  fetchProjectTasks,
  fetchTask,
  fetchTaskActivities,
  updateTaskAssignee,
  updateTaskStatus,
} from './api';

export function useProjectTasks(projectId: string) {
  return useQuery<Paginated<TaskSummary>>({
    queryKey: queryKeys.projectTasks(projectId),
    queryFn: () => fetchProjectTasks(projectId),
    enabled: projectId.length > 0,
  });
}

export function useTask(taskId: string) {
  return useQuery<TaskDetail>({
    queryKey: queryKeys.task(taskId),
    queryFn: () => fetchTask(taskId),
    enabled: taskId.length > 0,
  });
}

export function useCreateTask(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation<TaskDetail, Error, CreateTaskPayload>({
    mutationFn: (payload) => createTask(projectId, payload),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.projectTasks(projectId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.projects }),
      ]);
    },
  });
}

export function useUpdateTaskStatus(taskId: string, projectId: string) {
  const queryClient = useQueryClient();

  return useMutation<TaskDetail, Error, TaskStatus>({
    mutationFn: (status) => updateTaskStatus(taskId, status),
    onSuccess: async (task) => {
      queryClient.setQueryData(queryKeys.task(taskId), task);
      await queryClient.invalidateQueries({ queryKey: queryKeys.projectTasks(projectId) });
    },
  });
}

export function useUpdateTaskAssignee(taskId: string, projectId: string) {
  const queryClient = useQueryClient();

  return useMutation<TaskDetail, Error, string | null, { previousTask?: TaskDetail }>({
    mutationFn: (assigneeId) => updateTaskAssignee(taskId, assigneeId),
    onMutate: async (newAssigneeId) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.task(taskId) });
      const previousTask = queryClient.getQueryData<TaskDetail>(queryKeys.task(taskId));
      
      if (previousTask) {
        // Find the new assignee's UserSummary from the project members cache
        const members = queryClient.getQueryData<ProjectMemberEntry[]>(queryKeys.projectMembers(projectId)) || [];
        const newAssignee = newAssigneeId ? members.find((m) => m.user.id === newAssigneeId)?.user || null : null;

        queryClient.setQueryData<TaskDetail>(queryKeys.task(taskId), {
          ...previousTask,
          assignee: newAssignee,
        });
      }

      return { previousTask };
    },
    onError: (err, newAssigneeId, context) => {
      if (context?.previousTask) {
        queryClient.setQueryData(queryKeys.task(taskId), context.previousTask);
      }
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.task(taskId) });
      await queryClient.invalidateQueries({ queryKey: queryKeys.projectTasks(projectId) });
      await queryClient.invalidateQueries({ queryKey: queryKeys.taskActivities(taskId) });
    },
  });
}

export function useTaskActivities(taskId: string) {
  return useInfiniteQuery({
    queryKey: queryKeys.taskActivities(taskId),
    queryFn: ({ pageParam }) => fetchTaskActivities(taskId, pageParam as string | undefined),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled: taskId.length > 0,
  });
}
