import type { CreateProjectPayload, ProjectDetail, ProjectMemberEntry, ProjectSummary } from '@projectflow/shared';
import { apiRequest } from '@/lib/api-client';

export function fetchProjects(): Promise<ProjectSummary[]> {
  return apiRequest<ProjectSummary[]>('/projects');
}

export function fetchProject(projectId: string): Promise<ProjectDetail> {
  return apiRequest<ProjectDetail>(`/projects/${projectId}`);
}

export function fetchProjectMembers(projectId: string): Promise<ProjectMemberEntry[]> {
  return apiRequest<ProjectMemberEntry[]>(`/projects/${projectId}/members`);
}

export function createProject(payload: CreateProjectPayload): Promise<ProjectDetail> {
  return apiRequest<ProjectDetail>('/projects', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
