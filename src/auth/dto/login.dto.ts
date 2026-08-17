import { Transform } from 'class-transformer'
import { IsEmail, IsString, Length } from 'class-validator'

export class LoginDto {
  @Transform(({ value }: { value: string }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail({}, { message: 'Format email tidak valid.' })
  email: string

  @IsString()
  @Length(1, 72)
  password: string
}
