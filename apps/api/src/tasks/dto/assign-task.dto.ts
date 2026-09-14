import { IsMongoId, IsOptional, IsString } from 'class-validator';

export class AssignTaskDto {
  @IsOptional()
  @IsString()
  @IsMongoId()
  assigneeId?: string | null;
}
