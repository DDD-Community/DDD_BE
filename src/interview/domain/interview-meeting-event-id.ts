export const interviewMeetingEventId = ({
  uuid,
  generation,
}: {
  uuid: string;
  generation: number;
}): string => `ddd${uuid.replaceAll('-', '').toLowerCase()}g${generation}`;
