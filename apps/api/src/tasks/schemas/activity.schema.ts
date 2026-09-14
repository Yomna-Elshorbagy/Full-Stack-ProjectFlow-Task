import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { type HydratedDocument, Types } from 'mongoose';

export type ActivityDocument = HydratedDocument<Activity>;

export enum ActivityType {
  TASK_ASSIGNEE_CHANGED = 'TASK_ASSIGNEE_CHANGED',
}

@Schema({ timestamps: true, collection: 'activities' })
export class Activity {
  @Prop({ type: Types.ObjectId, ref: 'Task', required: true, index: true })
  taskId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  actorId: Types.ObjectId;

  @Prop({ type: String, enum: ActivityType, required: true })
  type: ActivityType;

  @Prop({ type: Object })
  metadata?: Record<string, any>;

  createdAt: Date;
  updatedAt: Date;
}

export const ActivitySchema = SchemaFactory.createForClass(Activity);
ActivitySchema.index({ taskId: 1, _id: -1 });
