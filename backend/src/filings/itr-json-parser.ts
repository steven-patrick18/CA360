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
  /** Structured Computation of Income — sectioned for display in the UI. */
  details: ItrDetails;
  /** Fields the parser couldn't locate — used to warn the user. */
  notes: string[];
}

export interface DetailRow {
  label: string;
  value: string | number | null;
}

export interface DetailSection {
  title: string;
  rows: DetailRow[];
}

export interface ItrDetails {
  sections: DetailSection[];
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

/** Pull the first non-null value via findFirst, return as a number row. */
function numRow(label: string, search: unknown, keys: string[]): DetailRow | null {
  const v = asNumber(findFirst(search, keys));
  return v === null ? null : { label, value: v };
}

function strRow(label: string, search: unknown, keys: string[]): DetailRow | null {
  const v = asString(findFirst(search, keys));
  return v === null ? null : { label, value: v };
}

/**
 * Build the structured Computation of Income from the parsed JSON. Every
 * lookup is best-effort — section is omitted entirely if no rows match.
 */
function buildDetails(search: unknown): ItrDetails {
  const sections: DetailSection[] = [];

  // Personal info
  const personal: DetailRow[] = [
    strRow('Name', search, ['AssesseeName', 'NameOfAssessee', 'AssesseName', 'FirstName']),
    strRow('PAN', search, ['PAN', 'AssesseePAN', 'PanNo']),
    strRow('Date of birth', search, ['DOB', 'DateOfBirth', 'DateOfIncorporation']),
    strRow('Status', search, ['ResidentialStatus', 'ResidentStatus', 'Status']),
    strRow('Aadhaar', search, ['AadhaarCardNo', 'AadhaarNumber']),
    strRow('Address', search, ['ResidenceNo', 'AddressDetail']),
    strRow('Email', search, ['EmailAddress', 'Email', 'EmailAddress_P']),
    strRow('Mobile', search, ['MobileNo', 'MobileNoOfAssessee']),
  ].filter((r): r is DetailRow => r !== null);
  if (personal.length) sections.push({ title: 'Personal', rows: personal });

  // Filing meta
  const filing: DetailRow[] = [
    strRow('Assessment Year', search, ['AssessmentYear', 'AssesmentYear', 'AssessYr']),
    strRow('ITR form', search, ['FormName', 'ITRForm']),
    strRow('Filing type', search, ['FilingType', 'ReturnFileSec']),
    strRow('Filed date', search, ['DateOfFiling', 'FilingDate', 'EFiledOn', 'EFilingDate']),
    strRow('Acknowledgement no', search, [
      'AckNo',
      'AcknowledgementNo',
      'AcknowledgmentNo',
      'AcknowledgementNumber',
      'EFilingAck',
    ]),
  ].filter((r): r is DetailRow => r !== null);
  if (filing.length) sections.push({ title: 'Filing details', rows: filing });

  // Income heads (Schedule-wise)
  const income: DetailRow[] = [
    numRow('Salary', search, ['IncomeFromSal', 'IncomeFromSalary', 'NetSalary', 'TotIncFromSal']),
    numRow('House property', search, ['IncomeFromHP', 'IncomeFromHouseProperty', 'TotalIncomeOfHP']),
    numRow('Business / profession', search, [
      'ProfitsGainsOfBusOrProf',
      'IncomeFromBusiness',
      'TotalIncomeOfPerson',
      'NetProfitFromBus',
    ]),
    numRow('Capital gains', search, ['TotalCapGains', 'CapitalGain', 'TotalCapitalGains']),
    numRow('Other sources', search, ['IncomeFromOS', 'IncomeOthSrc', 'IncomeFromOtherSources']),
    numRow('Gross total income', search, ['GrossTotIncome', 'GrossTotalIncome', 'GrossTotInc']),
  ].filter((r): r is DetailRow => r !== null);
  if (income.length) sections.push({ title: 'Income', rows: income });

  // Chapter VI-A deductions
  const ded: DetailRow[] = [
    numRow('80C — Investments', search, ['Section80C', 'Sec80C', 'TotalChapVIADeductions80C']),
    numRow('80CCC — Pension fund', search, ['Section80CCC', 'Sec80CCC']),
    numRow('80CCD(1) — NPS (employee)', search, ['Section80CCDEmployee', 'Sec80CCD1']),
    numRow('80CCD(1B) — NPS additional', search, ['Section80CCD1B', 'Sec80CCD1B']),
    numRow('80CCD(2) — NPS (employer)', search, ['Section80CCDEmployer', 'Sec80CCD2']),
    numRow('80D — Health insurance', search, ['Section80D', 'Sec80D']),
    numRow('80DD — Disabled dependent', search, ['Section80DD', 'Sec80DD']),
    numRow('80DDB — Specified illness', search, ['Section80DDB', 'Sec80DDB']),
    numRow('80E — Education loan', search, ['Section80E', 'Sec80E']),
    numRow('80EE — Home loan interest', search, ['Section80EE', 'Sec80EE']),
    numRow('80EEA — Affordable home', search, ['Section80EEA', 'Sec80EEA']),
    numRow('80EEB — Electric vehicle', search, ['Section80EEB', 'Sec80EEB']),
    numRow('80G — Donations', search, ['Section80G', 'Sec80G']),
    numRow('80GG — Rent paid', search, ['Section80GG', 'Sec80GG']),
    numRow('80GGA — Scientific research', search, ['Section80GGA', 'Sec80GGA']),
    numRow('80GGC — Political party', search, ['Section80GGC', 'Sec80GGC']),
    numRow('80TTA — Savings interest', search, ['Section80TTA', 'Sec80TTA']),
    numRow('80TTB — Senior citizen interest', search, ['Section80TTB', 'Sec80TTB']),
    numRow('80U — Self disability', search, ['Section80U', 'Sec80U']),
    numRow('Total deductions', search, ['TotalChapVIADeductions', 'DeductionUs10A']),
  ].filter((r): r is DetailRow => r !== null);
  if (ded.length) sections.push({ title: 'Chapter VI-A deductions', rows: ded });

  // Tax computation
  const tax: DetailRow[] = [
    numRow('Total income (taxable)', search, ['TotalIncome', 'TotIncome']),
    numRow('Tax on total income', search, ['TaxOnTotalIncome', 'TaxAtNormalRates', 'TaxPayable']),
    numRow('Surcharge', search, ['Surcharge', 'SurchargeOnTax']),
    numRow('Health & education cess', search, ['EducationCess', 'HealthEduCess', 'CessOnTax']),
    numRow('Gross tax liability', search, ['GrossTaxLiability', 'GrossTaxPay']),
    numRow('Rebate u/s 87A', search, ['Rebate87A', 'RebateUs87A']),
    numRow('Relief u/s 89', search, ['ReliefUs89', 'Relief89']),
    numRow('Net tax liability', search, ['NetTaxLiability', 'AggregateLiability']),
    numRow('Interest u/s 234A', search, ['IntrstPayUs234A', 'IntrstPay234A']),
    numRow('Interest u/s 234B', search, ['IntrstPayUs234B', 'IntrstPay234B']),
    numRow('Interest u/s 234C', search, ['IntrstPayUs234C', 'IntrstPay234C']),
    numRow('Total tax & interest', search, ['TotalTaxAndInterest', 'TotTaxIntr']),
  ].filter((r): r is DetailRow => r !== null);
  if (tax.length) sections.push({ title: 'Tax computation', rows: tax });

  // Taxes paid
  const paid: DetailRow[] = [
    numRow('TDS on salary', search, ['TotalTDSOnSal', 'TDSOnSalary']),
    numRow('TDS other than salary', search, ['TotalTDSOnOthThanSals', 'TDSOnOtherIncome']),
    numRow('TCS', search, ['TotalTCS', 'TCS']),
    numRow('Advance tax', search, ['TotalAdvanceTax', 'AdvanceTax']),
    numRow('Self-assessment tax', search, ['TotalSelfAssessmentTax', 'SelfAssessmentTax']),
    numRow('Total taxes paid', search, ['TotalTaxesPaid', 'TaxPaid', 'TotalTaxPaid']),
  ].filter((r): r is DetailRow => r !== null);
  if (paid.length) sections.push({ title: 'Taxes paid', rows: paid });

  // Refund / payable
  const refund: DetailRow[] = [
    numRow('Refund due', search, ['RefundDue', 'RefundAmount', 'Refund']),
    numRow('Tax payable', search, ['BalTaxPayable', 'TaxPayableOnTotInc', 'NetTaxLiabRefund']),
  ].filter((r): r is DetailRow => r !== null);
  if (refund.length) sections.push({ title: 'Refund / Payable', rows: refund });

  // Bank account
  const bank: DetailRow[] = [
    strRow('IFSC', search, ['IFSCCode', 'IFSC']),
    strRow('Bank account no', search, ['BankAccountNo', 'AccountNo', 'BankAcNo']),
    strRow('Bank account type', search, ['AccountType', 'TypeOfAccount']),
  ].filter((r): r is DetailRow => r !== null);
  if (bank.length) sections.push({ title: 'Bank account (refund)', rows: bank });

  return { sections };
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

  const details = buildDetails(search);

  return {
    pan: pan.toUpperCase(),
    assessmentYear,
    itrForm: form,
    filedDate,
    acknowledgementNo: ackNo,
    grossIncome,
    taxPaid,
    refundAmount,
    details,
    notes,
  };
}
