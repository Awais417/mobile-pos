import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

// Ye darban check karta hai ke valid token hai ya nahi.
// Kisi route pe @UseGuards(JwtAuthGuard) lagao → woh route sirf
// logged-in users ke liye ho jata hai. Token galat/na ho → 401 error.
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
