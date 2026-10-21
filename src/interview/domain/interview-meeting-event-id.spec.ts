import { interviewMeetingEventId } from './interview-meeting-event-id';

describe('interviewMeetingEventId', () => {
  it('UUID와 generation으로 Google base32hex 이벤트 ID를 만든다', () => {
    const eventId = interviewMeetingEventId({
      uuid: '123e4567-e89b-12d3-a456-426614174000',
      generation: 12,
    });

    expect(eventId).toBe('ddd123e4567e89b12d3a456426614174000g12');
    expect(eventId).toMatch(/^[a-v0-9]{5,1024}$/);
  });
});
