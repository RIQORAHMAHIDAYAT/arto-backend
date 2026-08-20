import { IsString, Length, Matches } from 'class-validator'

export class ChangePasswordDto {
  @IsString()
  @Length(8, 72, { message: 'Password minimal 8 karakter.' })
  @Matches(/^\S+$/, { message: 'Password tidak boleh mengandung spasi.' })
  currentPassword: string

  @IsString()
  @Length(8, 72, { message: 'Password baru minimal 8 karakter.' })
  @Matches(/^\S+$/, { message: 'Password baru tidak boleh mengandung spasi.' })
  newPassword: string
}