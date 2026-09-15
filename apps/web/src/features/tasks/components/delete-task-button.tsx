'use client';

import { useState } from 'react';
import { Trash } from '@phosphor-icons/react/dist/ssr';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useDeleteTask } from '../hooks';
import { isElevatedOrganizationRole, ProjectRole } from '@projectflow/shared';
import { useProjectMembers, useProject } from '@/features/projects/hooks';
import { useCurrentUser } from '@/features/auth/hooks';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

interface DeleteTaskButtonProps {
  taskId: string;
  projectId: string;
}

export function DeleteTaskButton({ taskId, projectId }: DeleteTaskButtonProps) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const deleteTask = useDeleteTask(projectId);
  
  const { data: currentUser } = useCurrentUser();
  const { data: project } = useProject(projectId);
  const { data: members = [] } = useProjectMembers(projectId);

  if (!currentUser || !project) return null;

  // 1. Check Project Role
  const myMemberEntry = members.find((m) => m.user.id === currentUser.id);
  const myProjectRole = myMemberEntry?.role ?? null;
  const isProjectManager = myProjectRole === ProjectRole.PROJECT_MANAGER;
  
  // 2. Check Organization Role
  const myOrg = currentUser.organizations.find((o) => o.id === project.organizationId);
  const myOrgRole = myOrg?.role ?? null;
  const isElevatedOrgRole = isElevatedOrganizationRole(myOrgRole);

  // According to backend ProjectAccessService, either role grants canManage permissions.
  const canManage = isProjectManager || isElevatedOrgRole;
  
  if (!canManage) {
    return null;
  }

  const handleDelete = () => {
    setIsDeleting(true);
    deleteTask.mutate(taskId, {
      onSuccess: () => {
        toast.success('Task deleted successfully');
        setIsOpen(false);
        router.push(`/projects/${projectId}`);
      },
      onError: (error) => {
        setIsDeleting(false);
        toast.error(error.message);
      },
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          variant="danger"
          size="sm"
          className="w-full justify-start gap-2"
          disabled={isDeleting || deleteTask.isPending}
        >
          <Trash size={16} />
          {isDeleting ? 'Deleting...' : 'Delete Task'}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Task</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete this task? This action cannot be undone and will remove all comments and activity logs.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="secondary" onClick={() => setIsOpen(false)} disabled={isDeleting}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleDelete} disabled={isDeleting}>
            {isDeleting ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
