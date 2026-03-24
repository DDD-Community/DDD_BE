import { Injectable } from '@nestjs/common';

@Injectable()
export class GoogleApiClient {
  async revokeToken({ token }: { token: string }): Promise<void> {
    await fetch(`https://oauth2.googleapis.com/revoke?token=${token}`, {
      method: 'POST',
      headers: {
        'Content-type': 'application/x-www-form-urlencoded',
      },
    });
  }
}
