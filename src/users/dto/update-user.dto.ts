import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator'

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string

  @IsOptional()
  @IsIn(['light', 'dark', 'system'])
  theme?: 'light' | 'dark' | 'system'
}
