import { apiRequest } from '@/lib/api-client';
import type { AddOrganizationMemberPayload } from '@projectflow/shared';

export function addOrganizationMember(organizationId: string, payload: AddOrganizationMemberPayload): Promise<{ success: boolean }> {
  return apiRequest<{ success: boolean }>(`/organizations/${organizationId}/members`, {
    method: 'POST',
    body: payload,
  });
}
