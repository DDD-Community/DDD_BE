import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';

import { AuthModule } from '../auth/auth.module';
import { RejectApplicantSessionGuard } from '../common/guard/reject-applicant-session.guard';
import { UserModule } from '../user/user.module';
import { GoogleAuthService } from './application/google-auth.service';
import { GoogleStrategy } from './infrastructure/google.strategy';
import { GoogleApiClient } from './infrastructure/google-api.client';
import { GoogleAuthController } from './interface/google-auth.controller';

@Module({
  imports: [UserModule, PassportModule, AuthModule],
  controllers: [GoogleAuthController],
  providers: [GoogleAuthService, GoogleStrategy, GoogleApiClient, RejectApplicantSessionGuard],
})
export class GoogleModule {}
