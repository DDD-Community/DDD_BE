import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { CohortPartName } from '../../cohort/domain/cohort-part-name';

const ROLE_ENV_KEY_BY_PART: Record<CohortPartName, string> = {
  [CohortPartName.PM]: 'DISCORD_ROLE_ID_PM',
  [CohortPartName.PD]: 'DISCORD_ROLE_ID_PD',
  [CohortPartName.BE]: 'DISCORD_ROLE_ID_BE',
  [CohortPartName.FE]: 'DISCORD_ROLE_ID_FE',
  [CohortPartName.IOS]: 'DISCORD_ROLE_ID_IOS',
  [CohortPartName.AND]: 'DISCORD_ROLE_ID_AOS',
};

@Injectable()
export class DiscordInviteService {
  private readonly logger = new Logger(DiscordInviteService.name);

  constructor(private readonly configService: ConfigService) {}

  resolveRoleIds({ partName }: { partName: CohortPartName }): string[] {
    const envKey = ROLE_ENV_KEY_BY_PART[partName];
    const roleId = this.configService.get<string>(envKey);
    if (!roleId) {
      this.logger.warn(`Discord role id not configured for part=${partName} (env=${envKey})`);
      return [];
    }
    return [roleId];
  }

  buildPersonalizedLinkUrl({
    applicationFormId,
    clientRedirectUrl,
  }: {
    applicationFormId: number;
    clientRedirectUrl: string;
  }): string {
    const base = clientRedirectUrl.replace(/\/$/, '');
    return `${base}/discord/link?applicationFormId=${applicationFormId}`;
  }
}
