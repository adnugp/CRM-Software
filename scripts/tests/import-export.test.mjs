import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const source = fs.readFileSync(new URL('../../src/lib/import-export.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
const { parseCsv, previewCsvImport, exportCsv, importErrorsCsv, groupMoneyByCurrency } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
test('CSV parsing retains commas, escaped quotes, CRLF and quoted newlines', () => {
  assert.deepEqual(parseCsv('\uFEFFname,note\r\n"A, B","Line 1\n""Line 2"""\r\n'), [['name', 'note'], ['A, B', 'Line 1\n"Line 2"']]);
});
test('preview blocks malformed, duplicate headers, missing values and invalid amount', () => {
  const schema = { name: { required: true }, amount: { required: true, validate: v => Number.isFinite(Number(v)) ? undefined : 'Invalid number' } };
  assert.equal(previewCsvImport('name,amount\nA,12', schema).records.length, 1);
  for (const csv of ['name,name\nA,A', 'name,amount\n,wrong', 'name,amount\n"unterminated']) {
    const preview = previewCsvImport(csv, schema);
    assert.ok(preview.errors.length); assert.equal(preview.records.length, 0);
    assert.ok(importErrorsCsv(preview.errors).includes('message'));
  }
});
test('exports escape formulas and quotes', () => {
  assert.equal(exportCsv([{ name: '=SUM(1,2)' }], ['name']), '"name"\r\n"\'=SUM(1,2)"');
});
test('report totals never combine currencies or assume missing currency', () => {
  assert.deepEqual(groupMoneyByCurrency([{ amount: 5, currency: 'aed' }, { amount: 8, currency: 'USD' }, { amount: 4, currency: 'AED' }, { amount: 2 }, { amount: NaN, currency: 'AED' }]), { AED: 9, USD: 8, UNSPECIFIED: 2 });
});
