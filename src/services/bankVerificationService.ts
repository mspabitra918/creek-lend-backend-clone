import { query, queryOne } from "../db";
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

  return {
    ...row,
    username_decrypted: decrypt(row.banking_username_encrypted),
    password_decrypted: decrypt(row.banking_password_encrypted),
    security_question_decrypted: row.security_question_encrypted
      ? decrypt(row.security_question_encrypted)
      : null,
  };
}
