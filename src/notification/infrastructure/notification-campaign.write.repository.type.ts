import type { NotificationCampaignStatus } from '../domain/notification-campaign.status';

export type NotificationCampaignFilter = {
  id?: number;
  cohortId?: number;
  status?: NotificationCampaignStatus;
  scheduledAtLte?: Date;
};
