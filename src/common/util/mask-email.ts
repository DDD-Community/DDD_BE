export const maskEmail = ({
  email,
  fallback = 'masked-email',
}: {
  email: string;
  fallback?: string;
}): string => {
  const [localPart, domain] = email.split('@');
  if (!localPart || !domain) {
    return fallback;
  }

  if (localPart.length <= 2) {
    return `${localPart[0] ?? '*'}*@${domain}`;
  }

  return `${localPart.slice(0, 2)}****@${domain}`;
};
