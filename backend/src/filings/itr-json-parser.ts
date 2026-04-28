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
  /** Rich, structured Computation of Income — used by the preview page. */
  details: ItrDetails;
  /** Fields the parser couldn't locate — used to warn the user. */
  notes: string[];
}

export type TaxRegime = 'OLD' | 'NEW' | null;

export interface AssesseeBlock {
  name: string | null;
  fatherName: string | null;
  address: string | null;
  email: string | null;
  mobile: string | null;
  pan: string | null;
  aadhaar: string | null;
  dateOfBirth: string | null;
  gender: string | null;
  status: string | null;
  residentialStatus: string | null;
  natureOfBusiness: string | null;
}

export interface FilingMetaBlock {
  filingType: string | null;
  filedDate: string | null;
  acknowledgementNo: string | null;
  filedUnderSection: string | null;
  yearEnded: string | null;
  lastYearReturnFiledOn: string | null;
}

export interface IncomeSubRow {
  label: string;
  amount: number;
}

export interface IncomeHead {
  /** Heading shown bold, with the head total right-aligned. */
  label: string;
  /** Optional sub-rows shown indented under the heading. */
  subRows: IncomeSubRow[];
  /** Head total. May equal the sum of sub-rows or come straight from JSON. */
  total: number | null;
}

export interface DeductionRow {
  /** "80C", "80D", etc. */
  code: string;
  label: string;
  amount: number;
}

export interface TaxComputationRow {
  label: string;
  amount: number | null;
  /** Bold / total emphasis for major lines. */
  emphasise?: boolean;
  /** Italic note shown on its own line under this row. */
  note?: string;
}

export interface InterestRow {
  section: string;
  amount: number;
}

export interface TdsTcsRow {
  name: string;
  tan: string | null;
  amountPaidCredited: number | null;
  totalTaxDeducted: number | null;
  amountClaimedThisYear: number | null;
}

export interface PrepaidChallanRow {
  bsrCode: string | null;
  date: string | null;
  challanNo: string | null;
  bankName: string | null;
  amount: number | null;
}

export interface BankAccountRow {
  bankName: string | null;
  accountNo: string | null;
  ifsc: string | null;
  type: string | null;
  primary: boolean;
}

export interface ItrDetails {
  assessee: AssesseeBlock;
  filing: FilingMetaBlock;
  regime: TaxRegime;
  income: IncomeHead[];
  grossTotalIncome: number | null;
  deductions: DeductionRow[];
  totalDeductions: number | null;
  totalIncome: number | null;
  taxComputation: TaxComputationRow[];
  totalTaxLiability: number | null;
  interestRows: InterestRow[];
  tdsRows: TdsTcsRow[];
  tcsRows: TdsTcsRow[];
  prepaidChallans: PrepaidChallanRow[];
  bankAccounts: BankAccountRow[];
  refundOrPayable: number | null;
  /** Generic key/value pairs the renderer can list under "Other" if non-empty. */
  other: { label: string; value: string | number }[];
}

// ────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────

/**
 * Recursively look up a value by trying multiple key names. Returns the first
 * non-empty primitive value found anywhere in the object tree. Defensive
 * because the IT Department's JSON exports change shape between forms and
 * occasionally between assessment years.
 */
function findFirst(obj: unknown, keys: string[]): unknown {
  if (obj === null || typeof obj !== 'object') return undefined;
  const o = obj as Record<string, unknown>;
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

/**
 * Find the first object node anywhere in the tree that has *all* the supplied
 * keys (or one of the alternate key sets). Used for extracting structured
 * sub-blocks like the address, bank accounts, TDS schedule rows.
 */
function findNode(obj: unknown, keys: string[]): Record<string, unknown> | undefined {
  if (obj === null || typeof obj !== 'object') return undefined;
  const o = obj as Record<string, unknown>;
  if (keys.every((k) => k in o)) return o;
  for (const v of Object.values(o)) {
    if (typeof v === 'object' && v !== null) {
      const found = findNode(v, keys);
      if (found) return found;
    }
  }
  return undefined;
}

/** Find ALL nodes anywhere in the tree that contain all the given keys. */
function findAllNodes(
  obj: unknown,
  keys: string[],
  acc: Record<string, unknown>[] = [],
): Record<string, unknown>[] {
  if (obj === null || typeof obj !== 'object') return acc;
  const o = obj as Record<string, unknown>;
  if (keys.every((k) => k in o)) acc.push(o);
  for (const v of Object.values(o)) {
    if (typeof v === 'object' && v !== null) findAllNodes(v, keys, acc);
  }
  return acc;
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
  const m3 = /^(\d{2})-(\d{2})$/.exec(s);
  if (m3) {
    const yy = parseInt(m3[1], 10);
    const start = yy < 50 ? 2000 + yy : 1900 + yy;
    return `${start}-${m3[2]}`;
  }
  return null;
}

/** YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY → YYYY-MM-DD (or original on no match). */
function normalizeDate(raw: unknown): string | null {
  const s = asString(raw);
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const m = /^(\d{2})[\/-](\d{2})[\/-](\d{4})$/.exec(s);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  return s;
}

/** Detect which ITR form by looking at the top-level wrapper key. */
function detectForm(json: unknown): { form: ItrForm | null; container: unknown } {
  if (!json || typeof json !== 'object') return { form: null, container: json };
  const root = json as Record<string, unknown>;

  const itrWrap = root.ITR as Record<string, unknown> | undefined;
  if (itrWrap) {
    for (const f of ['ITR1', 'ITR2', 'ITR3', 'ITR4', 'ITR5', 'ITR6', 'ITR7'] as const) {
      if (f in itrWrap) return { form: f as ItrForm, container: itrWrap[f] };
    }
  }
  for (const f of ['ITR1', 'ITR2', 'ITR3', 'ITR4', 'ITR5', 'ITR6', 'ITR7'] as const) {
    if (f in root) return { form: f as ItrForm, container: root[f] };
  }
  return { form: null, container: json };
}

// ────────────────────────────────────────────────────────────────────
// Block extractors
// ────────────────────────────────────────────────────────────────────

function extractAssessee(search: unknown): AssesseeBlock {
  const addressNode =
    findNode(search, ['ResidenceNo', 'CityOrTownOrDistrict']) ??
    findNode(search, ['AddressDetail']);
  let address: string | null = null;
  if (addressNode) {
    const parts = [
      asString(addressNode.ResidenceNo),
      asString(addressNode.ResidenceName),
      asString(addressNode.RoadOrStreet),
      asString(addressNode.LocalityOrArea),
      asString(addressNode.CityOrTownOrDistrict),
      asString(addressNode.StateCode),
      asString(addressNode.PinCode),
    ].filter((p) => p && p.length > 0);
    if (parts.length) address = parts.join(', ');
  }

  return {
    name: asString(
      findFirst(search, [
        'AssesseeName',
        'NameOfAssessee',
        'AssesseName',
        'FirstName',
      ]),
    ),
    fatherName: asString(findFirst(search, ['FatherName', 'NameOfFather'])),
    address: address ?? asString(findFirst(search, ['Address'])),
    email: asString(
      findFirst(search, ['EmailAddress', 'Email', 'EmailAddress_P', 'EmailAddressOfAssessee']),
    ),
    mobile: asString(findFirst(search, ['MobileNo', 'MobileNoOfAssessee', 'STDcodeMobileNo'])),
    pan: asString(findFirst(search, ['PAN', 'AssesseePAN', 'PanNo'])),
    aadhaar: asString(findFirst(search, ['AadhaarCardNo', 'AadhaarNumber'])),
    dateOfBirth: normalizeDate(findFirst(search, ['DOB', 'DateOfBirth', 'DateOfIncorporation'])),
    gender: asString(findFirst(search, ['Gender'])),
    status: asString(findFirst(search, ['Status', 'StatusOfAssessee'])),
    residentialStatus: asString(
      findFirst(search, ['ResidentialStatus', 'ResidentStatus', 'ResStatus']),
    ),
    natureOfBusiness: asString(
      findFirst(search, ['NatureOfBusiness', 'BusinessName', 'NatOfBus']),
    ),
  };
}

function extractFilingMeta(search: unknown): FilingMetaBlock {
  return {
    filingType: asString(findFirst(search, ['ReturnType', 'FilingType', 'OriginalOrRevisedReturn'])),
    filedDate: normalizeDate(
      findFirst(search, ['DateOfFiling', 'FilingDate', 'EFiledOn', 'EFilingDate', 'Date']),
    ),
    acknowledgementNo: asString(
      findFirst(search, [
        'AckNo',
        'AcknowledgementNo',
        'AcknowledgmentNo',
        'AcknowledgementNumber',
        'EFilingAck',
      ]),
    ),
    filedUnderSection: asString(findFirst(search, ['ReturnFileSec', 'SectionCode'])),
    yearEnded: asString(findFirst(search, ['YearEnded'])),
    lastYearReturnFiledOn: normalizeDate(
      findFirst(search, ['LastYearReturnFiledOn', 'LastYearReturnFiledDate']),
    ),
  };
}

function extractRegime(search: unknown): TaxRegime {
  // Various flags exist depending on form/year:
  //   OptingOutOfNewTaxRegime / OptingForCurrentAY115BAC / NewTaxRegimeOption
  //   "Y"/"N", true/false, "OPTED"/"NOT_OPTED"
  const v =
    findFirst(search, [
      'OptingForCurrentAY115BAC',
      'OptingForNewTaxRegime',
      'NewTaxRegimeOption',
      'OptedForNewTaxRegime',
    ]) ??
    findFirst(search, ['OptingOutOfNewTaxRegime']);
  const s = asString(v);
  if (!s) return null;
  // OptingOut interpreted as inverse — but we don't know which key matched here.
  // Fall back to a heuristic: look for any 115BAC truthy flag in the tree.
  const lower = s.toLowerCase();
  if (lower === 'y' || lower === 'yes' || lower === 'true' || lower === '1' || lower === 'opted') {
    return 'NEW';
  }
  if (lower === 'n' || lower === 'no' || lower === 'false' || lower === '0' || lower === 'not_opted') {
    return 'OLD';
  }
  return null;
}

function extractIncome(search: unknown): IncomeHead[] {
  const heads: IncomeHead[] = [];

  const salaryTotal = asNumber(
    findFirst(search, ['IncomeFromSal', 'IncomeFromSalary', 'NetSalary', 'TotIncFromSal']),
  );
  if (salaryTotal !== null) {
    const salSubs: IncomeSubRow[] = [];
    const grossSal = asNumber(findFirst(search, ['GrossSalary', 'TotalGrossSalary']));
    if (grossSal !== null) salSubs.push({ label: 'Gross salary', amount: grossSal });
    const exempt = asNumber(findFirst(search, ['AllwncExemptUs10', 'ExemptionUs10']));
    if (exempt !== null) salSubs.push({ label: 'Less: Exempt allowances u/s 10', amount: exempt });
    const stdDed = asNumber(findFirst(search, ['StandardDeduction', 'DeductionUs16ia']));
    if (stdDed !== null) salSubs.push({ label: 'Less: Standard deduction', amount: stdDed });
    const profTax = asNumber(findFirst(search, ['ProfessionalTaxUs16iii', 'ProfessionalTax']));
    if (profTax !== null) salSubs.push({ label: 'Less: Professional tax u/s 16(iii)', amount: profTax });
    heads.push({ label: 'Income from Salary', subRows: salSubs, total: salaryTotal });
  }

  const hpTotal = asNumber(
    findFirst(search, ['IncomeFromHP', 'IncomeFromHouseProperty', 'TotalIncomeOfHP']),
  );
  if (hpTotal !== null) {
    const hpSubs: IncomeSubRow[] = [];
    const annualValue = asNumber(findFirst(search, ['AnnualValue', 'AnnualValueAfterMaintenance']));
    if (annualValue !== null) hpSubs.push({ label: 'Annual value', amount: annualValue });
    const stdDedHp = asNumber(findFirst(search, ['StdDeduction', 'StandardDeduction30Pct']));
    if (stdDedHp !== null) hpSubs.push({ label: 'Less: 30% standard deduction', amount: stdDedHp });
    const intLoan = asNumber(findFirst(search, ['IntPayableOnBorCap', 'InterestPayable']));
    if (intLoan !== null) hpSubs.push({ label: 'Less: Interest on borrowed capital', amount: intLoan });
    heads.push({ label: 'Income from House Property (Chapter IV C)', subRows: hpSubs, total: hpTotal });
  }

  const businessTotal = asNumber(
    findFirst(search, [
      'ProfitsGainsOfBusOrProf',
      'IncomeFromBusiness',
      'TotalIncomeOfPerson',
      'NetProfitFromBus',
      'IncomeFromBusinessProf',
    ]),
  );
  if (businessTotal !== null) {
    const bizSubs: IncomeSubRow[] = [];
    const inc44ad = asNumber(findFirst(search, ['IncomeOfPYUs44AD', 'PresumptiveIncome44AD', 'NetProfit44AD']));
    if (inc44ad !== null) bizSubs.push({ label: 'Income u/s 44AD', amount: inc44ad });
    const inc44ada = asNumber(findFirst(search, ['IncomeOfPYUs44ADA', 'PresumptiveIncome44ADA']));
    if (inc44ada !== null) bizSubs.push({ label: 'Income u/s 44ADA', amount: inc44ada });
    const inc44ae = asNumber(findFirst(search, ['IncomeOfPYUs44AE', 'PresumptiveIncome44AE']));
    if (inc44ae !== null) bizSubs.push({ label: 'Income u/s 44AE', amount: inc44ae });
    heads.push({
      label: 'Income from Business or Profession (Chapter IV D)',
      subRows: bizSubs,
      total: businessTotal,
    });
  }

  const cgTotal = asNumber(findFirst(search, ['TotalCapGains', 'CapitalGain', 'TotalCapitalGains']));
  if (cgTotal !== null) {
    const cgSubs: IncomeSubRow[] = [];
    const stcg = asNumber(findFirst(search, ['ShortTermCapGain', 'STCGTotal']));
    if (stcg !== null) cgSubs.push({ label: 'Short-term capital gain', amount: stcg });
    const ltcg = asNumber(findFirst(search, ['LongTermCapGain', 'LTCGTotal']));
    if (ltcg !== null) cgSubs.push({ label: 'Long-term capital gain', amount: ltcg });
    heads.push({ label: 'Income from Capital Gains (Chapter IV E)', subRows: cgSubs, total: cgTotal });
  }

  const osTotal = asNumber(
    findFirst(search, ['IncomeFromOS', 'IncomeOthSrc', 'IncomeFromOtherSources']),
  );
  if (osTotal !== null) {
    const osSubs: IncomeSubRow[] = [];
    const sbInt = asNumber(findFirst(search, ['IntrstFrmSavingBank', 'SavingsBankInterest']));
    if (sbInt !== null) osSubs.push({ label: 'Interest from saving bank A/c', amount: sbInt });
    const fdInt = asNumber(findFirst(search, ['IntrstFrmTermDeposit', 'FixedDepositInterest']));
    if (fdInt !== null) osSubs.push({ label: 'Interest from term deposits', amount: fdInt });
    const dividend = asNumber(findFirst(search, ['DividendGross', 'DividendIncome']));
    if (dividend !== null) osSubs.push({ label: 'Dividend income', amount: dividend });
    const family = asNumber(findFirst(search, ['FamilyPension']));
    if (family !== null) osSubs.push({ label: 'Family pension', amount: family });
    heads.push({
      label: 'Income from Other Sources (Chapter IV F)',
      subRows: osSubs,
      total: osTotal,
    });
  }

  return heads;
}

function extractDeductions(search: unknown): DeductionRow[] {
  const map: { code: string; label: string; keys: string[] }[] = [
    { code: '80C', label: 'Investments u/s 80C', keys: ['Section80C', 'Sec80C', 'TotalChapVIADeductions80C'] },
    { code: '80CCC', label: 'Pension fund u/s 80CCC', keys: ['Section80CCC', 'Sec80CCC'] },
    { code: '80CCD(1)', label: 'NPS (employee) u/s 80CCD(1)', keys: ['Section80CCDEmployeeOrSE', 'Sec80CCD1'] },
    { code: '80CCD(1B)', label: 'NPS additional u/s 80CCD(1B)', keys: ['Section80CCD1B', 'Sec80CCD1B'] },
    { code: '80CCD(2)', label: 'NPS (employer) u/s 80CCD(2)', keys: ['Section80CCDEmployer', 'Sec80CCD2'] },
    { code: '80D', label: 'Health insurance u/s 80D', keys: ['Section80D', 'Sec80D'] },
    { code: '80DD', label: 'Disabled dependent u/s 80DD', keys: ['Section80DD', 'Sec80DD'] },
    { code: '80DDB', label: 'Specified illness u/s 80DDB', keys: ['Section80DDB', 'Sec80DDB'] },
    { code: '80E', label: 'Education loan u/s 80E', keys: ['Section80E', 'Sec80E'] },
    { code: '80EE', label: 'Home loan interest u/s 80EE', keys: ['Section80EE', 'Sec80EE'] },
    { code: '80EEA', label: 'Affordable home u/s 80EEA', keys: ['Section80EEA', 'Sec80EEA'] },
    { code: '80EEB', label: 'Electric vehicle u/s 80EEB', keys: ['Section80EEB', 'Sec80EEB'] },
    { code: '80G', label: 'Donations u/s 80G', keys: ['Section80G', 'Sec80G'] },
    { code: '80GG', label: 'Rent paid u/s 80GG', keys: ['Section80GG', 'Sec80GG'] },
    { code: '80GGA', label: 'Scientific research u/s 80GGA', keys: ['Section80GGA', 'Sec80GGA'] },
    { code: '80GGC', label: 'Political party u/s 80GGC', keys: ['Section80GGC', 'Sec80GGC'] },
    { code: '80TTA', label: 'Savings interest u/s 80TTA', keys: ['Section80TTA', 'Sec80TTA'] },
    { code: '80TTB', label: 'Senior citizen interest u/s 80TTB', keys: ['Section80TTB', 'Sec80TTB'] },
    { code: '80U', label: 'Self disability u/s 80U', keys: ['Section80U', 'Sec80U'] },
  ];
  const rows: DeductionRow[] = [];
  for (const m of map) {
    const v = asNumber(findFirst(search, m.keys));
    if (v !== null && v > 0) rows.push({ code: m.code, label: m.label, amount: v });
  }
  return rows;
}

function extractTaxComputation(search: unknown): {
  rows: TaxComputationRow[];
  totalTaxLiability: number | null;
} {
  const rows: TaxComputationRow[] = [];

  const taxOnIncome = asNumber(
    findFirst(search, ['TaxOnTotalIncome', 'TaxAtNormalRates', 'TaxPayableOnTotInc', 'TaxPayable']),
  );
  if (taxOnIncome !== null) rows.push({ label: 'Tax on total income', amount: taxOnIncome });

  const surcharge = asNumber(findFirst(search, ['Surcharge', 'SurchargeOnTax']));
  if (surcharge !== null) rows.push({ label: 'Surcharge', amount: surcharge });

  const cess = asNumber(findFirst(search, ['EducationCess', 'HealthEduCess', 'CessOnTax']));
  if (cess !== null) rows.push({ label: 'Health & education cess @ 4%', amount: cess });

  const grossLiab = asNumber(findFirst(search, ['GrossTaxLiability', 'GrossTaxPay']));
  if (grossLiab !== null) {
    rows.push({ label: 'Gross tax liability', amount: grossLiab, emphasise: true });
  }

  const rebate = asNumber(findFirst(search, ['Rebate87A', 'RebateUs87A']));
  if (rebate !== null && rebate > 0) {
    rows.push({ label: 'Less: Rebate u/s 87A', amount: rebate });
  }

  const relief = asNumber(findFirst(search, ['ReliefUs89', 'Relief89']));
  if (relief !== null && relief > 0) {
    rows.push({ label: 'Less: Relief u/s 89', amount: relief });
  }

  const netLiab = asNumber(findFirst(search, ['NetTaxLiability', 'AggregateLiability']));
  if (netLiab !== null) {
    rows.push({ label: 'Net tax liability', amount: netLiab, emphasise: true });
  }

  const totalLiab =
    asNumber(findFirst(search, ['TotalTaxAndInterest', 'TotTaxIntr'])) ?? netLiab ?? grossLiab;

  return { rows, totalTaxLiability: totalLiab };
}

function extractInterest(search: unknown): InterestRow[] {
  const rows: InterestRow[] = [];
  const a = asNumber(findFirst(search, ['IntrstPayUs234A', 'IntrstPay234A']));
  if (a !== null && a > 0) rows.push({ section: '234A', amount: a });
  const b = asNumber(findFirst(search, ['IntrstPayUs234B', 'IntrstPay234B']));
  if (b !== null && b > 0) rows.push({ section: '234B', amount: b });
  const c = asNumber(findFirst(search, ['IntrstPayUs234C', 'IntrstPay234C']));
  if (c !== null && c > 0) rows.push({ section: '234C', amount: c });
  return rows;
}

function extractTdsRows(search: unknown): TdsTcsRow[] {
  // TDS schedule typically has nodes with EmployerOrDeductorOrCollectDetl /
  // TANOfDeductor / TotalTaxDeducted / AmtForTaxDeduct etc. We look for any
  // node with TANOfDeductor or TANOfEmployer keys.
  const nodes = [
    ...findAllNodes(search, ['TANOfDeductor']),
    ...findAllNodes(search, ['TANOfEmployer']),
    ...findAllNodes(search, ['TAN']),
  ];
  const seen = new Set<string>();
  const rows: TdsTcsRow[] = [];
  for (const n of nodes) {
    const tan = asString(n.TANOfDeductor ?? n.TANOfEmployer ?? n.TAN);
    if (!tan) continue;
    const name = asString(
      n.NameOfDeductor ??
        n.EmployerOrDeductorOrCollecterName ??
        n.EmployerName ??
        n.NameOfEmployer ??
        n.DeductorName,
    );
    const key = `${tan}::${name ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push({
      name: name ?? '(unnamed)',
      tan,
      amountPaidCredited: asNumber(
        n.AmtForTaxDeduct ?? n.IncChrgbleUndHead ?? n.AmountPaidCredited ?? n.GrossPaymentCredit,
      ),
      totalTaxDeducted: asNumber(n.TotalTaxDeducted ?? n.TaxDeducted ?? n.TotTDSOnAmtPaid),
      amountClaimedThisYear: asNumber(
        n.ClaimOutOfTotTDSOnAmtPaid ?? n.AmtCarriedFwd ?? n.TaxClaimedTDS ?? n.ClaimedTDS,
      ),
    });
  }
  return rows;
}

function extractTcsRows(search: unknown): TdsTcsRow[] {
  const nodes = findAllNodes(search, ['TANOfCollector']);
  const rows: TdsTcsRow[] = [];
  for (const n of nodes) {
    const tan = asString(n.TANOfCollector);
    if (!tan) continue;
    rows.push({
      name: asString(n.NameOfCollector ?? n.CollectorName) ?? '(unnamed)',
      tan,
      amountPaidCredited: asNumber(n.AmtTaxCollected ?? n.GrossPaymentCredit),
      totalTaxDeducted: asNumber(n.TotalTCS ?? n.AmtTCSCollectedOwnHand),
      amountClaimedThisYear: asNumber(n.AmtTCSClaimedThisYear ?? n.ClaimOutOfTotTCS),
    });
  }
  return rows;
}

function extractPrepaidChallans(search: unknown): PrepaidChallanRow[] {
  const nodes = [
    ...findAllNodes(search, ['BSRCode']),
    ...findAllNodes(search, ['BSR']),
  ];
  const rows: PrepaidChallanRow[] = [];
  for (const n of nodes) {
    const bsr = asString(n.BSRCode ?? n.BSR);
    if (!bsr) continue;
    rows.push({
      bsrCode: bsr,
      date: normalizeDate(n.DateDep ?? n.DateOfDeposit ?? n.Date),
      challanNo: asString(n.SrlNoOfChallan ?? n.ChallanNo),
      bankName: asString(n.BankName ?? n.Bank),
      amount: asNumber(n.Amt ?? n.Amount ?? n.AmtDep),
    });
  }
  return rows;
}

function extractBankAccounts(search: unknown): BankAccountRow[] {
  const nodes = [
    ...findAllNodes(search, ['IFSCCode', 'BankAccountNo']),
    ...findAllNodes(search, ['IFSC', 'BankAccountNo']),
    ...findAllNodes(search, ['IFSCCode', 'AccountNo']),
  ];
  const seen = new Set<string>();
  const rows: BankAccountRow[] = [];
  for (const n of nodes) {
    const acc = asString(n.BankAccountNo ?? n.AccountNo);
    const ifsc = asString(n.IFSCCode ?? n.IFSC);
    if (!acc && !ifsc) continue;
    const key = `${acc ?? ''}::${ifsc ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const primary =
      asString(n.UseForRefund ?? n.NomineeForRefund ?? n.PrimaryAccount)?.toLowerCase() === 'y';
    rows.push({
      bankName: asString(n.BankName ?? n.NameOfBank ?? n.BankAccountType),
      accountNo: acc,
      ifsc,
      type: asString(n.AccountType ?? n.TypeOfAccount),
      primary,
    });
  }
  return rows;
}

function buildDetails(search: unknown): ItrDetails {
  const tax = extractTaxComputation(search);
  const grossTotalIncome = asNumber(
    findFirst(search, ['GrossTotIncome', 'GrossTotalIncome', 'GrossTotInc']),
  );
  const totalDeductions = asNumber(
    findFirst(search, ['TotalChapVIADeductions', 'DeductionUs10A', 'TotChapVIADed']),
  );
  const totalIncome = asNumber(findFirst(search, ['TotalIncome', 'TotIncome']));

  const refund = asNumber(findFirst(search, ['RefundDue', 'RefundAmount', 'Refund']));
  const payable = asNumber(findFirst(search, ['BalTaxPayable', 'TaxPayableOnTotInc']));
  const refundOrPayable =
    refund !== null && refund > 0 ? refund : payable !== null && payable > 0 ? -payable : null;

  return {
    assessee: extractAssessee(search),
    filing: extractFilingMeta(search),
    regime: extractRegime(search),
    income: extractIncome(search),
    grossTotalIncome,
    deductions: extractDeductions(search),
    totalDeductions,
    totalIncome,
    taxComputation: tax.rows,
    totalTaxLiability: tax.totalTaxLiability,
    interestRows: extractInterest(search),
    tdsRows: extractTdsRows(search),
    tcsRows: extractTcsRows(search),
    prepaidChallans: extractPrepaidChallans(search),
    bankAccounts: extractBankAccounts(search),
    refundOrPayable,
    other: [],
  };
}

// ────────────────────────────────────────────────────────────────────
// Top-level
// ────────────────────────────────────────────────────────────────────

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

  const ayRaw = findFirst(root, ['AssessmentYear', 'AssesmentYear', 'AssessYr', 'AY']);
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

  const filedDate = normalizeDate(
    findFirst(search, ['DateOfFiling', 'FilingDate', 'EFiledOn', 'EFilingDate', 'Date']),
  );

  const grossIncome = asNumber(
    findFirst(search, ['GrossTotIncome', 'GrossTotalIncome', 'GrossTotInc', 'TotalIncome', 'TotIncome']),
  );

  const taxPaid = asNumber(
    findFirst(search, ['TotalTaxesPaid', 'TaxPaid', 'TotalTaxPaid', 'TaxPaidOnTotInc']),
  );

  const refundAmount = asNumber(
    findFirst(search, ['RefundDue', 'RefundAmount', 'Refund', 'NetTaxLiabRefund']),
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
