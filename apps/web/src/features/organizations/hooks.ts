'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { AddOrganizationMemberPayload } from '@projectflow/shared';
import { queryKeys } from '@/lib/query-keys';
import { addOrganizationMember } from './api';

export function useAddOrganizationMember(organizationId: string) {
  const queryClient = useQueryClient();

  return useMutation<{ success: boolean }, Error, AddOrganizationMemberPayload>({
    mutationFn: (payload) => addOrganizationMember(organizationId, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.projects });
    },
  });
}
