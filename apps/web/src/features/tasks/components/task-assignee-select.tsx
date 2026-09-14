'use client';

import { toast } from 'sonner';
import type { UserSummary } from '@projectflow/shared';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useProjectMembers } from '@/features/projects/hooks';
import { useUpdateTaskAssignee } from '../hooks';
import { Avatar } from '@/components/ui/avatar';

interface TaskAssigneeSelectProps {
  taskId: string;
  projectId: string;
  assignee?: UserSummary | null;
}

export function TaskAssigneeSelect({ taskId, projectId, assignee }: TaskAssigneeSelectProps) {
  const { data: members = [] } = useProjectMembers(projectId);
  const updateAssignee = useUpdateTaskAssignee(taskId, projectId);

  const value = assignee ? assignee.id : 'unassigned';

  return (
    <Select
      value={value}
      disabled={updateAssignee.isPending}
      onValueChange={(val) => {
        const newAssigneeId = val === 'unassigned' ? null : val;
        updateAssignee.mutate(newAssigneeId, {
          onError: (error) => toast.error(error.message),
        });
      }}
    >
      <SelectTrigger aria-label="Task assignee">
        <SelectValue>
          {assignee ? (
            <div className="flex items-center gap-2">
              <Avatar user={assignee} size="sm" />
              <span className="truncate">{assignee.name}</span>
            </div>
          ) : (
            <span className="text-muted-foreground">Unassigned</span>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="unassigned">
          <span className="text-muted-foreground">Unassigned</span>
        </SelectItem>
        {members.map((member) => (
          <SelectItem key={member.user.id} value={member.user.id}>
            <div className="flex items-center gap-2">
              <Avatar user={member.user} size="sm" />
              <span>{member.user.name}</span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
