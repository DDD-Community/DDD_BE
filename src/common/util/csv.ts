export const escapeCsvField = (field: string, protectFormula = false): string => {
  let value = field;
  if (protectFormula && /^[=+\-@\t\r\n]/.test(value)) {
    value = `'${value}`;
  }

  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
};
