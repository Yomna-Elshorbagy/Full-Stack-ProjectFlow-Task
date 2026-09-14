'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { PlusIcon } from '@phosphor-icons/react/dist/ssr';
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
import { Textarea } from '@/components/ui/textarea';
import { useCreateProject } from '../hooks';

interface CreateProjectDialogProps {
  organizationId: string;
}

export function CreateProjectDialog({ organizationId }: CreateProjectDialogProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [key, setKey] = useState('');
  const [description, setDescription] = useState('');
  
  const createProject = useCreateProject();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !key) return;

    createProject.mutate(
      { organizationId, name, key, description },
      {
        onSuccess: () => {
          toast.success('Project created successfully');
          setOpen(false);
          setName('');
          setKey('');
          setDescription('');
        },
        onError: (error) => {
          toast.error(error.message || 'Failed to create project');
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-2">
          <PlusIcon size={16} weight="bold" />
          New Project
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create Project</DialogTitle>
            <DialogDescription>
              Create a new project in your organization to organize tasks.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Project Name</Label>
              <Input
                id="name"
                placeholder="e.g. Website Redesign"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
                required
                minLength={2}
                maxLength={80}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="key">Project Key</Label>
              <Input
                id="key"
                placeholder="e.g. WEB"
                value={key}
                onChange={(e) => setKey(e.target.value.toUpperCase())}
                required
                pattern="^[A-Z][A-Z0-9]{1,9}$"
                title="2-10 uppercase letters or digits, must start with a letter"
              />
              <p className="text-[12px] text-subtle-foreground">
                This will be used as the prefix for all task IDs (e.g. WEB-101).
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description (Optional)</Label>
              <Textarea
                id="description"
                placeholder="What is this project about?"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={500}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setOpen(false)}
              disabled={createProject.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={createProject.isPending || !name || !key}>
              {createProject.isPending ? 'Creating...' : 'Create project'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
