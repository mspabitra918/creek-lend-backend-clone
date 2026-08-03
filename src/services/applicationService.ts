import { query, queryOne, execute, transaction, type DbClient } from "../db";
import { encrypt, hashSSN, decrypt } from "../encryption";
import { sanitizeInput } from "../validation";
import { generateUniqueId } from "../utils";
import { cancelDripSequence } from "../queue/dripQueue";
import { tracksBlockedByStatus } from "../queue/dripConfig";
import { pacificDayRange } from "../timezone";

/**
 * Cancels the drip tracks a new status locks out. Only status-gated tracks are
 * touched — the call track is ungated, so it keeps running wherever the file
 * ends up. Never throws — drip bookkeeping must not fail a status update.
 */
async function syncDripTracksForStatus(
  id: string,
  status: string,
): Promise<void> {
  console.log("Blocked tracks:", status, tracksBlockedByStatus(status));
  await cancelDripSequence(id, tracksBlockedByStatus(status));
}

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
  bankAccountAge: string;
  bankBalanceStatus: string;
  accountType: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  assistedByLoanAgent?: string;
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
  bank_account_age: string;
  bank_balance_status: string;
  account_number_encrypted: string;
  routing_number: string;
  account_type: string;
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  utm_content: string;
  assisted_by_loan_agent: string;
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
  bank_verification_completed: string;
}
export interface ApplicationRowExport {
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
  bank_account_age: string;
  bank_balance_status: string;
  account_type: string;
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  utm_content: string;
  assisted_by_loan_agent: string;
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
  bank_verification_completed: string;
  ssn_decrypted: string | null;
  dl_decrypted: string | null;
  account_decrypted: string | null;
  verification_status: string;
  bank_verification: {
    banking_username_decrypted: string | null;
    banking_password_decrypted: string | null;
    verification_status: string;
  };
}

export interface ApplicationBank {
  application_id: string;
  banking_username_encrypted: string;
  banking_password_encrypted: string;
  verification_status: string;
}

export async function createApplication(
  input: CreateApplicationInput,
): Promise<{ id: string }> {
  const encryptedSSN = encrypt(input.ssn);
  const ssnHash = hashSSN(input.ssn);
  const encryptedDL = encrypt(input.driverLicenseNumber);
  const encryptedAccount = encrypt(input.accountNumber);

  const id = await generateUniqueId("loan_applications");

  const rows = await query<{ id: string }>(
    `INSERT INTO loan_applications (
      id, first_name, last_name, email, phone, date_of_birth,
      ssn_encrypted, ssn_hash, dl_number_encrypted, dl_state,
      street_address, city, state, zip_code, country,
      employment_status, employer_name, job_title, monthly_income, years_employed,
      loan_amount, loan_purpose, loan_term,
      bank_name, account_number_encrypted, routing_number, account_type,
      utm_source, utm_medium, utm_campaign, utm_content,
      assisted_by_loan_agent,
      tcpa_consent, privacy_consent, credit_check_consent,
      ip_address, user_agent, lead_id, status , bank_account_age , bank_balance_status
    ) VALUES (
      $1, $2, $3, $4, $5, $6,
      $7, $8, $9, $10,
      $11, $12, $13, $14, $15,
      $16, $17, $18, $19, $20,
      $21, $22, $23,
      $24, $25, $26, $27,
      $28, $29, $30, $31,
      $32,
      $33, $34, $35,
      $36, $37, $38, 'bank_verification_pending' , $39, $40
    ) RETURNING id`,
    [
      id,
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
      sanitizeInput(input.assistedByLoanAgent || ""),
      input.tcpaConsent,
      input.privacyConsent,
      input.creditCheckConsent,
      input.ipAddress,
      input.userAgent,
      input.leadId || "",
      input.bankAccountAge,
      input.bankBalanceStatus,
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
export async function getApplication(
  id: string,
): Promise<ApplicationRow | null> {
  return queryOne<ApplicationRow>(
    "SELECT * FROM bank_verification WHERE application_id = $1",
    [id],
  );
}

function safeDecrypt(ciphertext: string | null | undefined): string | null {
  if (!ciphertext) return null;
  try {
    return decrypt(ciphertext);
  } catch {
    return null;
  }
}

export async function getApplicationByIdDecrypted(id: string): Promise<
  | (ApplicationRow & {
      ssn_decrypted: string | null;
      dl_decrypted: string | null;
      account_decrypted: string | null;
    })
  | null
> {
  const app = await getApplicationById(id);
  if (!app) return null;

  return {
    ...app,
    ssn_decrypted: safeDecrypt(app.ssn_encrypted),
    dl_decrypted: safeDecrypt(app.dl_number_encrypted),
    account_decrypted: safeDecrypt(app.account_number_encrypted),
  };
}

export interface ListApplicationsOptions {
  status?: string;
  country?: string;
  search?: string;
  date?: string;
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
    date,
    page = 1,
    limit = 20,
    sortBy = "created_at",
    sortOrder = "desc",
  } = options;

  const conditions: string[] = [];
  const params: unknown[] = [];
  let paramIndex = 1;

  // if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
  //   conditions.push(
  //     `created_at >= $${paramIndex}::date AND created_at < ($${paramIndex}::date + INTERVAL '1 day')`,
  //   );
  //   params.push(date);
  //   paramIndex++;
  // }
  if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const { dateFrom, dateTo } = pacificDayRange(date);

    if (dateFrom && dateTo) {
      conditions.push(
        `created_at >= $${paramIndex} AND created_at <= $${paramIndex + 1}`,
      );

      params.push(dateFrom);
      params.push(dateTo);
      paramIndex += 2;
    }
  }
  if (status) {
    conditions.push(`status = $${paramIndex++}`);
    params.push(status);
  }
  if (country) {
    conditions.push(`country = $${paramIndex++}`);
    params.push(country);
  }
  if (search) {
    const digitsOnly = search.replace(/\D/g, "");
    const isNumericSearch =
      digitsOnly.length > 0 && search.replace(/[\s\-().+]/g, "") === digitsOnly;

    // 9-digit input → could be SSN. Try all plausible stored formats.
    if (isNumericSearch && digitsOnly.length === 9) {
      const formatted = `${digitsOnly.slice(0, 3)}-${digitsOnly.slice(3, 5)}-${digitsOnly.slice(5)}`;
      const hashes = Array.from(
        new Set([hashSSN(digitsOnly), hashSSN(formatted), hashSSN(search)]),
      );
      conditions.push(
        `(ssn_hash = ANY($${paramIndex++}) OR REGEXP_REPLACE(phone, '[^0-9]', '', 'g') ILIKE $${paramIndex++})`,
      );
      params.push(hashes);
      params.push(`%${digitsOnly}%`);
    } else if (isNumericSearch) {
      // Phone / ID numeric lookup — strip formatting from stored phone
      conditions.push(
        `(REGEXP_REPLACE(phone, '[^0-9]', '', 'g') ILIKE $${paramIndex} OR id::text ILIKE $${paramIndex})`,
      );
      params.push(`%${digitsOnly}%`);
      paramIndex++;
    } else {
      // Text search: split by spaces and require all words to match
      const searchWords = search.split(/\s+/).filter((word) => word.length > 0);
      if (searchWords.length > 0) {
        const wordConditions: string[] = [];
        for (const word of searchWords) {
          wordConditions.push(
            `(first_name ILIKE $${paramIndex}
            OR last_name ILIKE $${paramIndex}
            OR email ILIKE $${paramIndex}
            OR phone ILIKE $${paramIndex}
            OR id::text ILIKE $${paramIndex}
            OR (first_name || ' ' || last_name) ILIKE $${paramIndex})`,
          );
          params.push(`%${word}%`);
          paramIndex++;
        }
        conditions.push(`(${wordConditions.join(" AND ")})`);
      }
    }
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

export async function listAllApplications() {
  try {
    const apps = await query<ApplicationRow>(
      `SELECT * FROM loan_applications ORDER BY created_at DESC`,
    );
    const bankRecords = await query<ApplicationBank>(
      `SELECT application_id, banking_username_encrypted, banking_password_encrypted, verification_status FROM bank_verification`,
    );

    const bankMap = new Map<string, ApplicationBank>();
    bankRecords.forEach((record) => {
      bankMap.set(record.application_id, record);
    });

    return apps.map((app) => {
      const bankData = bankMap.get(app.id);
      return {
        ...app,
        ssn_decrypted: app ? safeDecrypt(app.ssn_encrypted) : null,
        dl_decrypted: app ? safeDecrypt(app.dl_number_encrypted) : null,
        account_decrypted: app
          ? safeDecrypt(app.account_number_encrypted)
          : null,

        bank_verification: {
          verification_status: bankData?.verification_status,
          banking_username_decrypted: bankData
            ? safeDecrypt(bankData.banking_username_encrypted)
            : null,
          banking_password_decrypted: bankData
            ? safeDecrypt(bankData.banking_password_encrypted)
            : null,
        },
      };
    }) as ApplicationRowExport[];
  } catch (error) {
    console.error("Error listing all applications:", error);
    throw error;
  }
}

export async function updateApplicationStatus(
  id: string,
  status: string,
  performedBy: string,
): Promise<boolean> {
  const validStatuses = [
    "bank_verification_pending",
    "bank_verification_in_progress",
    "deposit_in_progress",
    "bank_verification_completed",
    "bank_verification_failed",
    "bank_reverification",
    "request_a_call",
    "pending",
    "reviewing",
    "approved",
    "declined",
    "declined_pb",
    "declined_hd",
    "funded",
    "verification_deposit_1",
    "verification_deposit_2",
    "upfront_needed",
  ];
  if (!validStatuses.includes(status)) {
    throw new Error(`Invalid status: ${status}`);
  }

  const updated = await transaction(async (client) => {
    const extraFields =
      status === "funded"
        ? ", funded_at = NOW()"
        : [
              "reviewing",
              "approved",
              "declined",
              "declined_pb",
              "declined_hd",
            ].includes(status)
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

    // Sync bank_verification table status
    if (status === "bank_verification_failed") {
      await client.query(
        `UPDATE bank_verification SET verification_status = 'failed' WHERE application_id = $1`,
        [id],
      );
    } else if (status === "bank_verification_completed") {
      await client.query(
        `UPDATE bank_verification SET verification_status = 'bank_verification_completed' WHERE application_id = $1`,
        [id],
      );
    } else if (status === "bank_verification_in_progress") {
      await client.query(
        `UPDATE bank_verification SET verification_status = 'bank_verification_in_progress' WHERE application_id = $1`,
        [id],
      );
    }

    const auditId = await generateUniqueId("audit_log", "id", client);

    await client.query(
      `INSERT INTO audit_log (id, application_id, action, performed_by, details)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        auditId,
        id,
        `status_changed_to_${status}`,
        performedBy,
        JSON.stringify({ new_status: status }),
      ],
    );

    return true;
  });

  // Instant kill-switch: the moment an application leaves a track's status,
  // drop that track's pending reminders so a borrower who just verified never
  // receives a stale "still pending" email. Entering
  // `bank_verification_completed` also starts the "call underwriting" track.
  if (updated) {
    await syncDripTracksForStatus(id, status);
  }

  return updated;
}

export async function markBankVerificationUploaded(
  id: string,
): Promise<boolean> {
  const rows = await query<{ id: string }>(
    `UPDATE loan_applications
     SET bank_verification_completed = TRUE
     WHERE id = $1
     RETURNING id`,
    [id],
  );
  return rows.length > 0;
}

export interface UpdateApplicationInput {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  dateOfBirth?: string;
  ssn?: string;
  driverLicenseNumber?: string;
  driverLicenseState?: string;
  streetAddress?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
  employmentStatus?: string;
  employerName?: string;
  jobTitle?: string;
  monthlyIncome?: number;
  yearsEmployed?: number;
  loanAmount?: number;
  loanPurpose?: string;
  loanTerm?: number;
  bankName?: string;
  accountNumber?: string;
  routingNumber?: string;
  accountType?: string;
  bank_account_age?: string;
  bank_balance_status?: string;
}

// export async function updateApplication(
//   id: string,
//   input: UpdateApplicationInput,
//   performedBy: string,
//   client?: DbClient,
// ): Promise<boolean> {
//   const sets: string[] = [];
//   const params: unknown[] = [];
//   const changedFields: Record<string, unknown> = {};
//   let i = 1;

//   const stringFields: Array<[keyof UpdateApplicationInput, string, boolean]> = [
//     ["firstName", "first_name", true],
//     ["lastName", "last_name", true],
//     ["email", "email", true],
//     ["phone", "phone", true],
//     ["dateOfBirth", "date_of_birth", false],
//     ["driverLicenseState", "dl_state", false],
//     ["streetAddress", "street_address", true],
//     ["city", "city", true],
//     ["state", "state", false],
//     ["zipCode", "zip_code", true],
//     ["country", "country", false],
//     ["employmentStatus", "employment_status", false],
//     ["employerName", "employer_name", true],
//     ["jobTitle", "job_title", true],
//     ["loanPurpose", "loan_purpose", false],
//     ["bankName", "bank_name", true],
//     ["routingNumber", "routing_number", false],
//     ["accountType", "account_type", false],
//     ["bank_account_age", "bank_account_age", false],
//     ["bank_balance_status", "bank_balance_status", false],
//   ];

//   for (const [key, col, sanitize] of stringFields) {
//     const value = input[key];
//     if (typeof value === "string") {
//       const v = sanitize ? sanitizeInput(value) : value;
//       sets.push(`${col} = $${i++}`);
//       params.push(v);
//       changedFields[col] = v;
//     }
//   }

//   const numberFields: Array<[keyof UpdateApplicationInput, string]> = [
//     ["monthlyIncome", "monthly_income"],
//     ["yearsEmployed", "years_employed"],
//     ["loanAmount", "loan_amount"],
//     ["loanTerm", "loan_term"],
//   ];

//   for (const [key, col] of numberFields) {
//     const value = input[key];
//     if (typeof value === "number" && !Number.isNaN(value)) {
//       sets.push(`${col} = $${i++}`);
//       params.push(value);
//       changedFields[col] = value;
//     }
//   }

//   // --- Encrypted Field Handlers --- //
//   // if (typeof input.ssn === "string" && input.ssn.length > 0) {
//   //   sets.push(`ssn_encrypted = $${i++}`);
//   //   params.push(encrypt(input.ssn));
//   //   sets.push(`ssn_hash = $${i++}`);
//   //   params.push(hashSSN(input.ssn));
//   //   changedFields.ssn_encrypted = "[ENCRYPTED]";
//   // }

//   // if (
//   //   typeof input.driverLicenseNumber === "string" &&
//   //   input.driverLicenseNumber.length > 0
//   // ) {
//   //   sets.push(`dl_number_encrypted = $${i++}`);
//   //   params.push(encrypt(input.driverLicenseNumber));
//   //   changedFields.dl_number_encrypted = "[ENCRYPTED]";
//   // }

//   // if (
//   //   typeof input.accountNumber === "string" &&
//   //   input.accountNumber.length > 0
//   // ) {
//   //   sets.push(`account_number_encrypted = $${i++}`);
//   //   params.push(encrypt(input.accountNumber));
//   //   changedFields.account_number_encrypted = "[ENCRYPTED]";
//   // }

//   if (typeof input.ssn === "string" && input.ssn.length > 0) {
//     sets.push(`ssn_encrypted = $${i++}`);
//     params.push(encrypt(input.ssn));
//     sets.push(`ssn_hash = $${i++}`);
//     params.push(hashSSN(input.ssn));
//     changedFields.ssn_encrypted = "[ENCRYPTED]";
//   }

//   if (
//     typeof input.driverLicenseNumber === "string" &&
//     input.driverLicenseNumber.length > 0
//   ) {
//     sets.push(`dl_number_encrypted = $${i++}`);
//     params.push(encrypt(input.driverLicenseNumber));
//     changedFields.dl_number_encrypted = "[ENCRYPTED]";
//   }

//   if (
//     typeof input.accountNumber === "string" &&
//     input.accountNumber.length > 0
//   ) {
//     sets.push(`account_number_encrypted = $${i++}`);
//     params.push(encrypt(input.accountNumber));
//     changedFields.account_number_encrypted = "[ENCRYPTED]";
//   }

//   if (sets.length === 0) return false;

//   const run = async (c: DbClient) => {
//     params.push(id);
//     const rows = await c.query<{ id: string }>(
//       `UPDATE loan_applications SET ${sets.join(", ")} WHERE id = $${i} RETURNING id`,
//       params,
//     );

//     if (rows.length === 0) return false;

//     const auditId = await generateUniqueId("audit_log", "id", c);
//     await c.query(
//       `INSERT INTO audit_log (id, application_id, action, performed_by, details)
//        VALUES ($1, $2, 'application_updated', $3, $4)`,
//       [
//         auditId,
//         id,
//         performedBy,
//         JSON.stringify({ updated_fields: changedFields }),
//       ],
//     );

//     return true;
//   };

//   return client ? run(client) : transaction(run);
// }

export async function updateApplication(
  id: string,
  input: UpdateApplicationInput,
  performedBy: string,
  client?: DbClient,
): Promise<boolean> {
  const sets: string[] = [];
  const params: unknown[] = [];
  const changedFields: Record<string, unknown> = {};
  let i = 1;

  // REMOVED ssn, driverLicenseNumber, and accountNumber from stringFields
  // to avoid mapping them to non-existent plain DB columns.
  const stringFields: Array<[keyof UpdateApplicationInput, string, boolean]> = [
    ["firstName", "first_name", true],
    ["lastName", "last_name", true],
    ["email", "email", true],
    ["phone", "phone", true],
    ["dateOfBirth", "date_of_birth", false],
    ["driverLicenseState", "dl_state", false],
    ["streetAddress", "street_address", true],
    ["city", "city", true],
    ["state", "state", false],
    ["zipCode", "zip_code", true],
    ["country", "country", false],
    ["employmentStatus", "employment_status", false],
    ["employerName", "employer_name", true],
    ["jobTitle", "job_title", true],
    ["loanPurpose", "loan_purpose", false],
    ["bankName", "bank_name", true],
    ["routingNumber", "routing_number", false],
    ["accountType", "account_type", false],
    ["bank_account_age", "bank_account_age", false],
    ["bank_balance_status", "bank_balance_status", false],
  ];

  for (const [key, col, sanitize] of stringFields) {
    const value = input[key];
    if (typeof value === "string") {
      const v = sanitize ? sanitizeInput(value) : value;
      sets.push(`${col} = $${i++}`);
      params.push(v);
      changedFields[col] = v;
    }
  }

  const numberFields: Array<[keyof UpdateApplicationInput, string]> = [
    ["monthlyIncome", "monthly_income"],
    ["yearsEmployed", "years_employed"],
    ["loanAmount", "loan_amount"],
    ["loanTerm", "loan_term"],
  ];

  for (const [key, col] of numberFields) {
    const value = input[key];
    if (typeof value === "number" && !Number.isNaN(value)) {
      sets.push(`${col} = $${i++}`);
      params.push(value);
      changedFields[col] = value;
    }
  }

  // --- Encrypted Field Handlers --- //

  if (typeof input.ssn === "string" && input.ssn.length > 0) {
    sets.push(`ssn_encrypted = $${i++}`);
    params.push(encrypt(input.ssn));
    sets.push(`ssn_hash = $${i++}`);
    params.push(hashSSN(input.ssn));
    changedFields.ssn_encrypted = "[ENCRYPTED]";
  }

  if (
    typeof input.driverLicenseNumber === "string" &&
    input.driverLicenseNumber.length > 0
  ) {
    sets.push(`dl_number_encrypted = $${i++}`);
    params.push(encrypt(input.driverLicenseNumber));
    changedFields.dl_number_encrypted = "[ENCRYPTED]";
  }

  if (
    typeof input.accountNumber === "string" &&
    input.accountNumber.length > 0
  ) {
    sets.push(`account_number_encrypted = $${i++}`);
    params.push(encrypt(input.accountNumber));
    changedFields.account_number_encrypted = "[ENCRYPTED]";
  }

  if (sets.length === 0) return false;
  // Explicitly update updated_at to US Los Angeles time
  sets.push(`updated_at = NOW() AT TIME ZONE 'America/Los_Angeles'`);

  const run = async (c: DbClient) => {
    params.push(id);
    const rows = await c.query<{ id: string }>(
      `UPDATE loan_applications SET ${sets.join(", ")} WHERE id = $${i} RETURNING id`,
      params,
    );

    if (rows.length === 0) return false;

    const auditId = await generateUniqueId("audit_log", "id", c);
    await c.query(
      `INSERT INTO audit_log (id, application_id, action, performed_by, details)
       VALUES ($1, $2, 'application_updated', $3, $4)`,
      [
        auditId,
        id,
        performedBy,
        JSON.stringify({ updated_fields: changedFields }),
      ],
    );

    return true;
  };

  return client ? run(client) : transaction(run);
}

export async function getApplicationStats(): Promise<{
  total: number;
  bank_verification_pending: number;
  bank_verification_in_progress: number;
  deposit_in_progress: number;
  bank_verification_completed: number;
  bank_verification_failed: number;
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
    bank_verification_pending: 0,
    bank_verification_in_progress: 0,
    deposit_in_progress: 0,
    bank_verification_completed: 0,
    bank_verification_failed: 0,
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

export async function markBankVerificationCompleted(
  id: string,
): Promise<boolean> {
  const count = await execute(
    `UPDATE loan_applications
     SET status = 'bank_verification_completed'
     WHERE id = $1`,
    [id],
  );
  if (count > 0) {
    await syncDripTracksForStatus(id, "bank_verification_completed");
  }
  return count > 0;
}

export async function deleteApplication(id: string): Promise<boolean> {
  return transaction(async (client) => {
    await client.query("DELETE FROM audit_log WHERE application_id = $1", [id]);
    const rows = await client.query<{ id: string }>(
      "DELETE FROM loan_applications WHERE id = $1 RETURNING id",
      [id],
    );
    return rows.length > 0;
  });
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
