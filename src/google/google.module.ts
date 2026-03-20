import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';

import { AuthModule } from '../auth/auth.module';
import { UserModule } from '../user/user.module';
import { GoogleAuthService } from './application/google-auth.service';
import { GoogleStrategy } from './infrastructure/google.strategy';
import { GoogleAuthController } from './interface/google-auth.controller';

@Module({
  imports: [UserModule, PassportModule, AuthModule],
  controllers: [GoogleAuthController],
  providers: [GoogleAuthService, GoogleStrategy],
})
export class GoogleModule {}
