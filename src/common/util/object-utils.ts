export const filterDefinedFields = (patch: Record<string, unknown>): Record<string, unknown> => {
  return Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== undefined));
};

export const hasDefinedValues = (patch: Record<string, unknown>): boolean => {
  return Object.values(patch).some((value) => value !== undefined);
};
