'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { PlusIcon } from '@phosphor-icons/react/dist/ssr';
import { OrganizationRole } from '@projectflow/shared';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAddOrganizationMember } from '../hooks';

interface AddMemberDialogProps {
  organizationId: string;
}

export function AddMemberDialog({ organizationId }: AddMemberDialogProps) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<OrganizationRole>(OrganizationRole.MEMBER);
  
  const addMember = useAddOrganizationMember(organizationId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    addMember.mutate(
      { email, role },
      {
        onSuccess: () => {
          toast.success('Member added to organization successfully');
          setOpen(false);
          setEmail('');
          setRole(OrganizationRole.MEMBER);
        },
        onError: (error) => {
          toast.error(error.message || 'Failed to add member');
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          className="ml-auto flex items-center justify-center rounded-md p-1 hover:bg-surface-strong text-muted-foreground hover:text-foreground transition-colors"
          title="Add organization member"
        >
          <PlusIcon size={14} weight="bold" />
        </button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Add Organization Member</DialogTitle>
            <DialogDescription>
              Directly add an existing user to this organization.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email address</Label>
              <Input
                id="email"
                type="email"
                placeholder="user@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoFocus
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Select value={role} onValueChange={(val) => setRole(val as OrganizationRole)}>
                <SelectTrigger id="role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={OrganizationRole.MEMBER}>Member</SelectItem>
                  <SelectItem value={OrganizationRole.ADMIN}>Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setOpen(false)}
              disabled={addMember.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={addMember.isPending || !email}>
              {addMember.isPending ? 'Adding...' : 'Add member'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
