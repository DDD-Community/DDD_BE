export type BlogPostFilter = {
  id?: number;
};

export type BlogPostUpdatePatch = {
  title?: string;
  excerpt?: string;
  thumbnail?: string;
  externalUrl?: string;
};
