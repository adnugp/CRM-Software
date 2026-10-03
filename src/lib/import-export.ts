export type CsvError = { row: number; field: string; message: string };
export type CsvSchema = Record<string, { required?: boolean; validate?: (value: string) => string | undefined }>;

/** RFC 4180 quoting including embedded newlines. Never execute CSV formulas. */
export function parseCsv(input: string): string[][] {
  const text = input.replace(/^\uFEFF/, '');
  const rows: string[][] = [];
  let row: string[] = [], field = '', quoted = false, closed = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') { quoted = false; closed = true; }
      else field += c;
    } else if (c === '"') {
      if (field || closed) throw new Error('Unexpected quote in CSV field');
      quoted = true;
    } else if (c === ',') { row.push(field); field = ''; closed = false; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); rows.push(row); row = []; field = ''; closed = false;
    } else {
      if (closed) throw new Error('Characters after closing CSV quote');
      field += c;
    }
  }
  if (quoted) throw new Error('Unclosed CSV quote');
  if (field || row.length || closed) { row.push(field); rows.push(row); }
  return rows;
}
export function previewCsvImport(input: string, schema: CsvSchema, maxRows = 1000): { records: Record<string, string>[]; errors: CsvError[]; total: number } {
  const records: Record<string, string>[] = [], errors: CsvError[] = [];
  let rows: string[][];
  try { rows = parseCsv(input); } catch (error) { return { records, total: 0, errors: [{ row: 1, field: '', message: error instanceof Error ? error.message : 'Malformed CSV' }] }; }
  const headers = (rows.shift() || []).map(h => h.trim());
  if (!headers.length || new Set(headers).size !== headers.length || headers.some(h => !h || !Object.prototype.hasOwnProperty.call(schema, h) || ['__proto__', 'constructor', 'prototype'].includes(h))) errors.push({ row: 1, field: '', message: 'Headers must be unique supported field names' });
  for (const [name, rule] of Object.entries(schema)) if (rule.required && !headers.includes(name)) errors.push({ row: 1, field: name, message: 'Required column missing' });
  if (rows.length > maxRows) errors.push({ row: 1, field: '', message: `Maximum ${maxRows} rows per import` });
  rows.forEach((values, index) => {
    const rowNumber = index + 2;
    if (values.length !== headers.length) { errors.push({ row: rowNumber, field: '', message: 'Column count differs from header' }); return; }
    const record: Record<string, string> = {};
    headers.forEach((header, column) => {
      const value = values[column].trim(); record[header] = value;
      const rule = schema[header];
      if (rule?.required && !value) errors.push({ row: rowNumber, field: header, message: 'Required value missing' });
      if (value && rule?.validate) { const message = rule.validate(value); if (message) errors.push({ row: rowNumber, field: header, message }); }
    });
    records.push(record);
  });
  // Callers can display invalid records, but cannot receive an importable batch accidentally.
  return { records: errors.length ? [] : records, errors, total: rows.length };
}
export function exportCsv(records: Record<string, unknown>[], headers: string[]): string {
  const quote = (value: unknown) => {
    let text = value == null ? '' : String(value);
    if (/^[\s]*[=+\-@]/.test(text)) text = `'${text}`;
    return `"${text.replaceAll('"', '""')}"`;
  };
  return [headers.map(quote).join(','), ...records.map(row => headers.map(h => quote(row[h])).join(','))].join('\r\n');
}
export function importErrorsCsv(errors: CsvError[]): string {
  return exportCsv(errors.map(error => ({ ...error })), ['row', 'field', 'message']);
}
export function groupMoneyByCurrency(records: { amount: number; currency?: string }[]): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const record of records) {
    if (!Number.isFinite(record.amount)) continue;
    const currency = record.currency?.trim().toUpperCase() || 'UNSPECIFIED';
    totals[currency] = (totals[currency] || 0) + record.amount;
  }
  return totals;
}
