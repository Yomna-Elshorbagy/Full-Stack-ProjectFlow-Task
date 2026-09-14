'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateProjectPayload, ProjectDetail, ProjectMemberEntry, ProjectSummary } from '@projectflow/shared';
import { queryKeys } from '@/lib/query-keys';
import { createProject, fetchProject, fetchProjectMembers, fetchProjects } from './api';

export function useProjects() {
  return useQuery<ProjectSummary[]>({
    queryKey: queryKeys.projects,
    queryFn: fetchProjects,
  });
}

export function useProject(projectId: string) {
  return useQuery<ProjectDetail>({
    queryKey: queryKeys.project(projectId),
    queryFn: () => fetchProject(projectId),
    enabled: projectId.length > 0,
  });
}

export function useProjectMembers(projectId: string) {
  return useQuery<ProjectMemberEntry[]>({
    queryKey: queryKeys.projectMembers(projectId),
    queryFn: () => fetchProjectMembers(projectId),
    enabled: projectId.length > 0,
  });
}

export function useCreateProject() {
  const queryClient = useQueryClient();

  return useMutation<ProjectDetail, Error, CreateProjectPayload>({
    mutationFn: createProject,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.projects });
    },
  });
}
