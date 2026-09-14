import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type SequenceDocument = Sequence & Document;

@Schema({ collection: 'project_sequences' })
export class Sequence {
  @Prop({ type: Types.ObjectId, required: true, unique: true, index: true })
  projectId!: Types.ObjectId;

  @Prop({ type: Number, default: 0 })
  seq!: number;
}

export const SequenceSchema = SchemaFactory.createForClass(Sequence);
