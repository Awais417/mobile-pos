import { Module } from '@nestjs/common';
import { UsersService } from './users.service';

// Users ka module — UsersService ko bundle karta hai.
@Module({
  providers: [UsersService],
  exports: [UsersService], // doosre modules bhi use kar sakein
})
export class UsersModule {}
