type BuildIcsInput = {
  uid: string;
  summary: string;
  startAt: Date;
  endAt: Date;
  location?: string;
  description?: string;
};

const formatIcsDate = (date: Date): string => {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  const hours = String(date.getUTCHours()).padStart(2, '0');
  const minutes = String(date.getUTCMinutes()).padStart(2, '0');
  const seconds = String(date.getUTCSeconds()).padStart(2, '0');
  return `${year}${month}${day}T${hours}${minutes}${seconds}Z`;
};

const escapeIcsText = (input: string): string =>
  input
    .replaceAll('\\', '\\\\')
    .replaceAll('\n', '\\n')
    .replaceAll(',', '\\,')
    .replaceAll(';', '\\;');

export const buildIcsFile = ({
  uid,
  summary,
  startAt,
  endAt,
  location,
  description,
}: BuildIcsInput): string => {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//DDD//Interview//KO',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${formatIcsDate(new Date())}`,
    `DTSTART:${formatIcsDate(startAt)}`,
    `DTEND:${formatIcsDate(endAt)}`,
    `SUMMARY:${escapeIcsText(summary)}`,
  ];

  if (location) {
    lines.push(`LOCATION:${escapeIcsText(location)}`);
  }
  if (description) {
    lines.push(`DESCRIPTION:${escapeIcsText(description)}`);
  }

  lines.push('END:VEVENT', 'END:VCALENDAR');
  return lines.join('\r\n');
};
