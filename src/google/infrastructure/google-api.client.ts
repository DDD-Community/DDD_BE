import { Injectable } from '@nestjs/common';

@Injectable()
export class GoogleApiClient {
  async revokeToken({ token }: { token: string }) {
    const response = await fetch(`https://oauth2.googleapis.com/revoke?token=${token}`, {
      method: 'POST',
      headers: {
        'Content-type': 'application/x-www-form-urlencoded',
      },
    });
    if (!response.ok) {
      throw new Error(`Google token revocation failed: ${response.status}`);
    }
  }
}
