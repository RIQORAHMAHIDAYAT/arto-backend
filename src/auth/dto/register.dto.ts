import { Transform } from 'class-transformer'
import { IsEmail, IsOptional, IsString, Length, Matches, MaxLength } from 'class-validator'

export class RegisterDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string

  @Transform(({ value }: { value: string }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail({}, { message: 'Format email tidak valid.' })
  email: string

  @IsString()
  @Length(8, 72, { message: 'Password minimal 8 karakter.' })
  @Matches(/^\S+$/, { message: 'Password tidak boleh mengandung spasi.' })
  password: string
}
