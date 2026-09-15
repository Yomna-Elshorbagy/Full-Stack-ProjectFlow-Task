'use client';

import { useTaskActivities } from '../hooks';
import { Avatar } from '@/components/ui/avatar';
import { formatDateTime } from '@/lib/format';
import { Skeleton } from '@/components/ui/skeleton';

interface TaskActivityTimelineProps {
  taskId: string;
  projectId: string;
}

export function TaskActivityTimeline({ taskId, projectId }: TaskActivityTimelineProps) {
  const { data, isPending, isError, hasNextPage, fetchNextPage, isFetchingNextPage } = useTaskActivities(taskId);

  if (isPending) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-4 w-64" />
      </div>
    );
  }

  if (isError) {
    return <div className="text-[13px] text-danger">Failed to load activity.</div>;
  }

  const activities = data?.pages.flatMap((page) => page.items) || [];

  if (activities.length === 0) {
    return null;
  }

  return (
    <section aria-label="Activity Timeline" className="mt-10 space-y-5 border-t border-border pt-8">
      <div className="flex items-center gap-2 mb-2">
        <h2 className="text-sm font-semibold tracking-tight text-foreground">Activity History</h2>
        <span className="flex h-5 items-center justify-center rounded-full bg-secondary px-2 text-[11px] font-medium text-secondary-foreground">
          {activities.length}
        </span>
      </div>
      
      <div className="relative">
        {/* The vertical timeline line */}
        <div className="absolute left-[15px] top-4 bottom-4 w-px bg-border shadow-sm" />
        
        <ul className="space-y-6">
          {activities.map((activity, index) => {
            let actionText = 'performed an action';
            let actionHighlight = null;
            
            if (activity.type === 'TASK_ASSIGNEE_CHANGED') {
              const toUser = activity.metadata?.to;
              const fromUser = activity.metadata?.from;
              
              if (toUser) {
                const assignedName = toUser.name;
                
                if (fromUser) {
                  if (fromUser.id === activity.actor.id) {
                    actionText = `changed the assignee from themselves to`;
                  } else {
                    actionText = `changed the assignee from ${fromUser.name} to`;
                  }
                } else {
                  actionText = `assigned`;
                }
                actionHighlight = assignedName;
              } else {
                actionText = 'removed the assignee';
              }
            }

            return (
              <li 
                key={activity.id} 
                className="group relative flex items-start gap-4 text-[13px] transition-all duration-300 ease-out hover:translate-x-1"
              >
                <div className="relative z-10 flex h-8 w-8 items-center justify-center rounded-full bg-background ring-4 ring-background shadow-sm transition-transform duration-300 group-hover:scale-105">
                  <Avatar user={activity.actor} size="sm" />
                </div>
                
                <div className="flex-1 rounded-xl border border-transparent p-3 -mt-2 transition-colors duration-200 group-hover:border-border/50 group-hover:bg-muted/30">
                  <p className="text-foreground leading-relaxed">
                    <span className="font-semibold text-foreground/90 mr-1.5">{activity.actor.name}</span>
                    <span className="text-muted-foreground">{actionText}</span>
                    {actionHighlight && (
                      <span className="font-semibold text-foreground/90 ml-1.5 bg-primary/10 text-primary px-1.5 py-0.5 rounded-md">
                        {actionHighlight}
                      </span>
                    )}
                  </p>
                  <p className="text-[11px] font-medium text-muted-foreground/70 mt-1 flex items-center gap-1.5">
                    <span className="inline-block w-1 h-1 rounded-full bg-muted-foreground/30" />
                    {formatDateTime(activity.createdAt)}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {hasNextPage && (
        <div className="pt-4 pl-12">
          <button
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
            className="inline-flex items-center justify-center rounded-md text-[12px] font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/80 px-4 py-2 transition-all duration-200 disabled:opacity-50"
          >
            {isFetchingNextPage ? (
              <span className="animate-pulse">Loading history...</span>
            ) : (
              'Load previous activity'
            )}
          </button>
        </div>
      )}
    </section>
  );
}
