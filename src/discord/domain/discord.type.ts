export type DiscordLinkCreateInput = {
  applicationFormId: number;
  discordUserId: string;
  discordUsername: string;
  rolesAssigned: string[];
  invitedAt?: Date;
};

export type DiscordTokenExchangeResult = {
  accessToken: string;
  refreshToken?: string;
  tokenType: string;
  scope: string;
  expiresIn: number;
};

export type DiscordUser = {
  id: string;
  username: string;
  globalName?: string;
};

export type LinkApplicantCommand = {
  applicationFormId: number;
  oauthCode: string;
};
