import { ItrForm } from '@prisma/client';

/**
 * Result of parsing an ITR JSON file downloaded from the Income Tax e-Filing
 * portal. All fields except `pan` and `assessmentYear` are best-effort —
 * different ITR forms (ITR-1 through ITR-7) nest the same data under
 * different keys, and not every return populates every field.
 */
export interface ParsedItr {
  pan: string;
  assessmentYear: string;
  itrForm: ItrForm | null;
  filedDate: string | null;
  acknowledgementNo: string | null;
  grossIncome: number | null;
  taxPaid: number | null;
  refundAmount: number | null;
  /** Fields the parser couldn't locate — used to warn the user. */
  notes: string[];
}

/**
 * Recursively look up a value by trying multiple key names. Returns the first
 * non-empty primitive value found anywhere in the object tree. Defensive
 * because the IT Department's JSON exports change shape between forms and
 * occasionally between assessment years.
 */
function findFirst(obj: unknown, keys: string[]): unknown {
  if (obj === null || typeof obj !== 'object') return undefined;
  const o = obj as Record<string, unknown>;
  // Direct match — only return *primitive* values. If a matching key holds
  // a sub-object (e.g. ITR1's `Refund: { RefundDue: 3000 }`), keep searching
  // so we recurse into it on the next pass.
  for (const k of keys) {
    if (k in o) {
      const v = o[k];
      if (v !== undefined && v !== null && v !== '' && typeof v !== 'object') return v;
    }
  }
  for (const v of Object.values(o)) {
    if (typeof v === 'object' && v !== null) {
      const found = findFirst(v, keys);
      if (found !== undefined) return found;
    }
  }
  return undefined;
}

function asString(v: unknown): string | null {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s.length === 0 ? null : s;
}

function asNumber(v: unknown): number | null {
  if (v === undefined || v === null || v === '') return null;
  const n = typeof v === 'number' ? v : Number(String(v).replace(/[, ]/g, ''));
  return Number.isFinite(n) ? n : null;
}

/**
 * "2024" → "2024-25", "2024-25" passes through. Anything else returns null.
 */
function normalizeAY(raw: unknown): string | null {
  const s = asString(raw);
  if (!s) return null;
  const m1 = /^(\d{4})-(\d{2})$/.exec(s);
  if (m1) return s;
  const m2 = /^(\d{4})$/.exec(s);
  if (m2) {
    const start = parseInt(m2[1], 10);
    const end = String((start + 1) % 100).padStart(2, '0');
    return `${start}-${end}`;
  }
  // ITR JSON sometimes uses YY-YY (e.g. "24-25")
  const m3 = /^(\d{2})-(\d{2})$/.exec(s);
  if (m3) {
    const yy = parseInt(m3[1], 10);
    const start = yy < 50 ? 2000 + yy : 1900 + yy;
    return `${start}-${m3[2]}`;
  }
  return null;
}

/** Detect which ITR form by looking at the top-level wrapper key. */
function detectForm(json: unknown): { form: ItrForm | null; container: unknown } {
  if (!json || typeof json !== 'object') return { form: null, container: json };
  const root = json as Record<string, unknown>;

  // Standard wrapping: { "ITR": { "ITR1": {...} } }
  const itrWrap = root.ITR as Record<string, unknown> | undefined;
  if (itrWrap) {
    for (const f of ['ITR1', 'ITR2', 'ITR3', 'ITR4', 'ITR5', 'ITR6', 'ITR7'] as const) {
      if (f in itrWrap) return { form: f as ItrForm, container: itrWrap[f] };
    }
  }

  // Some exports drop the outer "ITR": { "ITR1_FormName": ... }
  for (const f of ['ITR1', 'ITR2', 'ITR3', 'ITR4', 'ITR5', 'ITR6', 'ITR7'] as const) {
    if (f in root) return { form: f as ItrForm, container: root[f] };
  }

  return { form: null, container: json };
}

/**
 * Parse an ITR JSON document. Throws if essential fields (PAN + AY) are
 * missing — without those we can't match the import to a client.
 */
export function parseItrJson(json: unknown): ParsedItr {
  if (!json || typeof json !== 'object') {
    throw new Error('Not a valid JSON object');
  }

  const { form, container } = detectForm(json);
  const notes: string[] = [];
  if (!form) notes.push('Could not detect which ITR form (ITR-1..ITR-7) this is.');

  const root = json as Record<string, unknown>;
  const search = container ?? root;

  const pan = asString(findFirst(root, ['PAN', 'AssesseePAN', 'PanNo']));
  if (!pan) throw new Error('PAN not found in the JSON. Is this a valid ITR file?');
  if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/i.test(pan)) {
    throw new Error(`Found "${pan}" where PAN was expected — looks invalid.`);
  }

  const ayRaw = findFirst(root, [
    'AssessmentYear',
    'AssesmentYear',
    'AssessYr',
    'AY',
  ]);
  const assessmentYear = normalizeAY(ayRaw);
  if (!assessmentYear) {
    throw new Error('Assessment Year not found or unrecognised in the JSON.');
  }

  const ackNo = asString(
    findFirst(root, [
      'AckNo',
      'AcknowledgementNo',
      'AcknowledgmentNo',
      'AcknowledgementNumber',
      'EFilingAck',
    ]),
  );
  if (!ackNo) notes.push('Acknowledgement number not in JSON (expected only after filing).');

  // Filed date — Verification.Date is the most common; some forms use FilingDate
  const filedRaw = findFirst(search, [
    'DateOfFiling',
    'FilingDate',
    'EFiledOn',
    'EFilingDate',
    'Date',
  ]);
  let filedDate: string | null = null;
  if (filedRaw) {
    const s = asString(filedRaw);
    if (s) {
      // Accept YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY
      if (/^\d{4}-\d{2}-\d{2}$/.test(s)) filedDate = s;
      else {
        const m = /^(\d{2})[\/-](\d{2})[\/-](\d{4})$/.exec(s);
        if (m) filedDate = `${m[3]}-${m[2]}-${m[1]}`;
      }
    }
  }

  const grossIncome = asNumber(
    findFirst(search, [
      'GrossTotIncome',
      'GrossTotalIncome',
      'GrossTotInc',
      'TotalIncome',
      'TotIncome',
    ]),
  );

  const taxPaid = asNumber(
    findFirst(search, [
      'TotalTaxesPaid',
      'TaxPaid',
      'TotalTaxPaid',
      'TaxPaidOnTotInc',
    ]),
  );

  const refundAmount = asNumber(
    findFirst(search, [
      'RefundDue',
      'RefundAmount',
      'Refund',
      'NetTaxLiabRefund',
    ]),
  );

  if (grossIncome === null) notes.push('Gross income not found.');
  if (taxPaid === null) notes.push('Tax paid not found.');
  if (refundAmount === null) notes.push('Refund / payable amount not found.');

  return {
    pan: pan.toUpperCase(),
    assessmentYear,
    itrForm: form,
    filedDate,
    acknowledgementNo: ackNo,
    grossIncome,
    taxPaid,
    refundAmount,
    notes,
  };
}
