import type { AttendanceScheduleSyncItem } from './attendance.type';

type CurriculumScheduleResult = {
  schedules: AttendanceScheduleSyncItem[];
  ignoredWeeks: number[];
  timelessWeeks: { week: number; date: string; name: string; description: string }[];
};

export const toAttendanceSchedules = (curriculum: unknown[]): CurriculumScheduleResult => {
  const schedules: AttendanceScheduleSyncItem[] = [];
  const ignoredWeeks: number[] = [];
  const timelessWeeks: CurriculumScheduleResult['timelessWeeks'] = [];
  const dates = new Set<string>();

  curriculum.forEach((week, index) => {
    if (!isRecord(week)) {
      ignoredWeeks.push(index + 1);
      return;
    }

    const { date, time, description } = week;
    if (typeof date !== 'string' || !isDate(date)) {
      ignoredWeeks.push(index + 1);
      return;
    }

    if (dates.has(date)) {
      ignoredWeeks.push(index + 1);
      return;
    }
    dates.add(date);

    if (typeof description !== 'string' || description.trim().length === 0) {
      ignoredWeeks.push(index + 1);
      return;
    }

    const trimmedDescription = description.trim();
    const name = trimmedDescription.slice(0, 30);
    const shortDescription = trimmedDescription.slice(0, 100);
    if (typeof time !== 'string' || !isTime(time)) {
      ignoredWeeks.push(index + 1);
      timelessWeeks.push({
        week: index + 1,
        date,
        name,
        description: shortDescription,
      });
      return;
    }

    schedules.push({
      date,
      scheduleTime: time,
      name,
      description: shortDescription,
    });
  });

  return { schedules, ignoredWeeks, timelessWeeks };
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isDate = (value: string): boolean => {
  const matched = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!matched) {
    return false;
  }
  const [, year, month, day] = matched;
  const date = new Date(`${value}T00:00:00Z`);
  return (
    date.getUTCFullYear() === Number(year) &&
    date.getUTCMonth() + 1 === Number(month) &&
    date.getUTCDate() === Number(day)
  );
};

const isTime = (value: string): boolean => {
  const matched = /^(\d{2}):(\d{2})$/.exec(value);
  if (!matched) {
    return false;
  }
  const [, hour, minute] = matched;
  return Number(hour) <= 23 && Number(minute) <= 59;
};
