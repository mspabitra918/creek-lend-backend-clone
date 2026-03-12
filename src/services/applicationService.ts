import { query, queryOne, execute, transaction } from "../db";
import { encrypt, hashSSN, decrypt } from "../encryption";
import { sanitizeInput } from "../validation";

export interface CreateApplicationInput {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  ssn: string;
  driverLicenseNumber: string;
  driverLicenseState: string;
  streetAddress: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  employmentStatus: string;
  employerName: string;
  jobTitle: string;
  monthlyIncome: number;
  yearsEmployed: number;
  loanAmount: number;
  loanPurpose: string;
  loanTerm: number;
  bankName: string;
  accountNumber: string;
  routingNumber: string;
  accountType: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  tcpaConsent: boolean;
  privacyConsent: boolean;
  creditCheckConsent: boolean;
  ipAddress: string;
  userAgent: string;
  leadId?: string;
}

export interface ApplicationRow {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  date_of_birth: string;
  ssn_encrypted: string;
  ssn_hash: string;
  dl_number_encrypted: string;
  dl_state: string;
  street_address: string;
  city: string;
  state: string;
  zip_code: string;
  country: string;
  employment_status: string;
  employer_name: string;
  job_title: string;
  monthly_income: number;
  years_employed: number;
  loan_amount: number;
  loan_purpose: string;
  loan_term: number;
  bank_name: string;
  account_number_encrypted: string;
  routing_number: string;
  account_type: string;
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  utm_content: string;
  tcpa_consent: boolean;
  privacy_consent: boolean;
  credit_check_consent: boolean;
  ip_address: string;
  user_agent: string;
  lead_id: string;
  status: string;
  created_at: string;
  updated_at: string;
  reviewed_at: string | null;
  funded_at: string | null;
}

export async function createApplication(
  input: CreateApplicationInput,
): Promise<{ id: string }> {
  const encryptedSSN = encrypt(input.ssn);
  const ssnHash = hashSSN(input.ssn);
  const encryptedDL = encrypt(input.driverLicenseNumber);
  const encryptedAccount = encrypt(input.accountNumber);

  const rows = await query<{ id: string }>(
    `INSERT INTO loan_applications (
      first_name, last_name, email, phone, date_of_birth,
      ssn_encrypted, ssn_hash, dl_number_encrypted, dl_state,
      street_address, city, state, zip_code, country,
      employment_status, employer_name, job_title, monthly_income, years_employed,
      loan_amount, loan_purpose, loan_term,
      bank_name, account_number_encrypted, routing_number, account_type,
      utm_source, utm_medium, utm_campaign, utm_content,
      tcpa_consent, privacy_consent, credit_check_consent,
      ip_address, user_agent, lead_id, status
    ) VALUES (
      $1, $2, $3, $4, $5,
      $6, $7, $8, $9,
      $10, $11, $12, $13, $14,
      $15, $16, $17, $18, $19,
      $20, $21, $22,
      $23, $24, $25, $26,
      $27, $28, $29, $30,
      $31, $32, $33,
      $34, $35, $36, 'pending'
    ) RETURNING id`,
    [
      sanitizeInput(input.firstName),
      sanitizeInput(input.lastName),
      sanitizeInput(input.email),
      sanitizeInput(input.phone),
      input.dateOfBirth,
      encryptedSSN,
      ssnHash,
      encryptedDL,
      input.driverLicenseState,
      sanitizeInput(input.streetAddress),
      sanitizeInput(input.city),
      input.state,
      sanitizeInput(input.zipCode),
      input.country,
      input.employmentStatus,
      sanitizeInput(input.employerName),
      sanitizeInput(input.jobTitle),
      input.monthlyIncome,
      input.yearsEmployed,
      input.loanAmount,
      input.loanPurpose,
      input.loanTerm,
      sanitizeInput(input.bankName),
      encryptedAccount,
      input.routingNumber,
      input.accountType,
      sanitizeInput(input.utmSource || ""),
      sanitizeInput(input.utmMedium || ""),
      sanitizeInput(input.utmCampaign || ""),
      sanitizeInput(input.utmContent || ""),
      input.tcpaConsent,
      input.privacyConsent,
      input.creditCheckConsent,
      input.ipAddress,
      input.userAgent,
      input.leadId || "",
    ],
  );

  return { id: rows[0].id };
}

export async function getApplicationById(
  id: string,
): Promise<ApplicationRow | null> {
  return queryOne<ApplicationRow>(
    "SELECT * FROM loan_applications WHERE id = $1",
    [id],
  );
}

export async function getApplicationByIdDecrypted(id: string): Promise<
  | (ApplicationRow & {
      ssn_decrypted: string;
      dl_decrypted: string;
      account_decrypted: string;
    })
  | null
> {
  const app = await getApplicationById(id);
  if (!app) return null;

  return {
    ...app,
    ssn_decrypted: decrypt(app.ssn_encrypted),
    dl_decrypted: decrypt(app.dl_number_encrypted),
    account_decrypted: decrypt(app.account_number_encrypted),
  };
}

export interface ListApplicationsOptions {
  status?: string;
  country?: string;
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export async function listApplications(
  options: ListApplicationsOptions = {},
): Promise<{ applications: ApplicationRow[]; total: number }> {
  const {
    status,
    country,
    search,
    page = 1,
    limit = 20,
    sortBy = "created_at",
    sortOrder = "desc",
  } = options;

  const conditions: string[] = [];
  const params: unknown[] = [];
  let paramIndex = 1;

  if (status) {
    conditions.push(`status = $${paramIndex++}`);
    params.push(status);
  }
  if (country) {
    conditions.push(`country = $${paramIndex++}`);
    params.push(country);
  }
  if (search) {
    conditions.push(
      `(first_name ILIKE $${paramIndex} OR last_name ILIKE $${paramIndex} OR email ILIKE $${paramIndex})`,
    );
    params.push(`%${search}%`);
    paramIndex++;
  }

  const whereClause =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const allowedSortColumns = [
    "created_at",
    "updated_at",
    "loan_amount",
    "status",
    "first_name",
    "last_name",
    "email",
  ];
  const safeSortBy = allowedSortColumns.includes(sortBy)
    ? sortBy
    : "created_at";
  const safeSortOrder = sortOrder === "asc" ? "ASC" : "DESC";

  const offset = (page - 1) * limit;

  const [applications, countResult] = await Promise.all([
    query<ApplicationRow>(
      `SELECT * FROM loan_applications ${whereClause}
       ORDER BY ${safeSortBy} ${safeSortOrder}
       LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
      [...params, limit, offset],
    ),
    query<{ count: string }>(
      `SELECT COUNT(*) as count FROM loan_applications ${whereClause}`,
      params,
    ),
  ]);

  return {
    applications,
    total: parseInt(countResult[0]?.count || "0", 10),
  };
}

export async function updateApplicationStatus(
  id: string,
  status: string,
  performedBy: string,
): Promise<boolean> {
  const validStatuses = [
    "pending",
    "reviewing",
    "approved",
    "declined",
    "funded",
  ];
  if (!validStatuses.includes(status)) {
    throw new Error(`Invalid status: ${status}`);
  }

  const updated = await transaction(async (client) => {
    const extraFields =
      status === "funded"
        ? ", funded_at = NOW()"
        : ["reviewing", "approved", "declined"].includes(status)
          ? ", reviewed_at = NOW()"
          : "";

    const rows = await client.query<{ id: string }>(
      `UPDATE loan_applications
       SET status = $1${extraFields}
       WHERE id = $2
       RETURNING id`,
      [status, id],
    );

    if (rows.length === 0) return false;

    await client.query(
      `INSERT INTO audit_log (application_id, action, performed_by, details)
       VALUES ($1, $2, $3, $4)`,
      [
        id,
        `status_changed_to_${status}`,
        performedBy,
        JSON.stringify({ new_status: status }),
      ],
    );

    return true;
  });

  return updated;
}

export async function getApplicationStats(): Promise<{
  total: number;
  pending: number;
  reviewing: number;
  approved: number;
  declined: number;
  funded: number;
  totalLoanAmount: number;
  averageLoanAmount: number;
}> {
  const rows = await query<{
    status: string;
    count: string;
    total_amount: string;
  }>(
    `SELECT status, COUNT(*) as count, COALESCE(SUM(loan_amount), 0) as total_amount
     FROM loan_applications
     GROUP BY status`,
  );

  const stats = {
    total: 0,
    pending: 0,
    reviewing: 0,
    approved: 0,
    declined: 0,
    funded: 0,
    totalLoanAmount: 0,
    averageLoanAmount: 0,
  };

  for (const row of rows) {
    const count = parseInt(row.count, 10);
    const amount = parseFloat(row.total_amount);
    stats.total += count;
    stats.totalLoanAmount += amount;
    if (row.status in stats) {
      (stats as Record<string, number>)[row.status] = count;
    }
  }

  stats.averageLoanAmount =
    stats.total > 0 ? stats.totalLoanAmount / stats.total : 0;

  return stats;
}

export async function deleteApplication(id: string): Promise<boolean> {
  const rowCount = await execute(
    "DELETE FROM loan_applications WHERE id = $1",
    [id],
  );
  return rowCount > 0;
}

export async function getApplicationByIdAndEmail(
  id: string,
  email: string,
): Promise<{
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  loan_amount: number;
  loan_purpose: string;
  loan_term: number;
  status: string;
  created_at: string;
  updated_at: string;
  reviewed_at: string | null;
  funded_at: string | null;
} | null> {
  return queryOne(
    `SELECT id, first_name, last_name, email, loan_amount, loan_purpose, loan_term,
            status, created_at, updated_at, reviewed_at, funded_at
     FROM loan_applications
     WHERE id = $1 AND LOWER(email) = LOWER($2)`,
    [id, email],
  );
}

export async function checkDuplicateSSN(ssn: string): Promise<boolean> {
  const hash = hashSSN(ssn);
  const row = await queryOne<{ count: string }>(
    "SELECT COUNT(*) as count FROM loan_applications WHERE ssn_hash = $1",
    [hash],
  );
  return parseInt(row?.count || "0", 10) > 0;
}

export async function getAuditLog(applicationId: string): Promise<
  {
    id: string;
    action: string;
    performed_by: string;
    details: Record<string, unknown>;
    created_at: string;
  }[]
> {
  return query(
    `SELECT id, action, performed_by, details, created_at
     FROM audit_log
     WHERE application_id = $1
     ORDER BY created_at DESC`,
    [applicationId],
  );
}
