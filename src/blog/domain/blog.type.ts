export type BlogPostCreateType = {
  title: string;
  excerpt: string;
  thumbnail?: string;
  externalUrl: string;
};

export type BlogPostUpdateType = {
  title?: string;
  excerpt?: string;
  thumbnail?: string;
  externalUrl?: string;
};
