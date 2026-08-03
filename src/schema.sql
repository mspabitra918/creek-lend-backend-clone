-- Brook Loans Database Schema
-- PostgreSQL

-- Enable extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE OR REPLACE FUNCTION set_pdt_timestamps()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW(); -- Store standard UTC
    IF (TG_OP = 'INSERT') THEN
        NEW.created_at = NOW(); -- Store standard UTC
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Loan Applications Table
CREATE TABLE IF NOT EXISTS loan_applications (
    id VARCHAR(5) PRIMARY KEY,

    -- Personal Information
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    date_of_birth DATE NOT NULL,

    -- Identification (ENCRYPTED)
    ssn_encrypted TEXT NOT NULL,          -- AES-256 encrypted
    ssn_hash VARCHAR(64) NOT NULL,        -- SHA-256 hash for lookups
    dl_number_encrypted TEXT NOT NULL,     -- AES-256 encrypted
    dl_state VARCHAR(5) NOT NULL,

    -- Address
    street_address VARCHAR(100) NOT NULL,
    city VARCHAR(50) NOT NULL,
    state VARCHAR(5) NOT NULL,
    zip_code VARCHAR(10) NOT NULL,
    country VARCHAR(2) NOT NULL CHECK (country IN ('US', 'CA', 'IN')),

    -- Employment
    employment_status VARCHAR(20) NOT NULL,
    employer_name VARCHAR(100) NOT NULL,
    job_title VARCHAR(50) NOT NULL,
    monthly_income DECIMAL(12, 2) NOT NULL,
    years_employed DECIMAL(4, 1) NOT NULL,

    -- Loan Details
    loan_amount DECIMAL(12, 2) NOT NULL CHECK (loan_amount >= 1000 AND loan_amount <= 50000),
    loan_purpose VARCHAR(30) NOT NULL,
    loan_term INTEGER NOT NULL CHECK (loan_term IN (12, 24, 36, 48, 60)),

    -- Banking (ENCRYPTED)
    bank_name VARCHAR(100) NOT NULL,
    account_number_encrypted TEXT NOT NULL,  -- AES-256 encrypted
    routing_number VARCHAR(11) NOT NULL,
    bank_account_age VARCHAR(100),
    bank_balance_status VARCHAR(30) CHECK (bank_balance_status IN ('positive_balance', 'overdrawn')),
    account_type VARCHAR(10) NOT NULL CHECK (account_type IN ('checking', 'savings')),
    bank_verification_completed BOOLEAN NOT NULL DEFAULT FALSE,

    -- UTM Tracking
    utm_source VARCHAR(255) DEFAULT '',
    utm_medium VARCHAR(255) DEFAULT '',
    utm_campaign VARCHAR(255) DEFAULT '',
    utm_content VARCHAR(255) DEFAULT '',

    -- Referral Tracking
    assisted_by_loan_agent VARCHAR(255) DEFAULT '',

    -- Consent
    tcpa_consent BOOLEAN NOT NULL DEFAULT FALSE,
    privacy_consent BOOLEAN NOT NULL DEFAULT FALSE,
    credit_check_consent BOOLEAN NOT NULL DEFAULT FALSE,

    -- Meta
    ip_address VARCHAR(45) NOT NULL,
    user_agent TEXT DEFAULT '',
    lead_id VARCHAR(255) DEFAULT '',       -- Jornaya/TrustedForm
    status VARCHAR(30) NOT NULL DEFAULT 'bank_verification_pending' CHECK (status IN ('bank_verification_pending', 'deposit_in_progress', 'bank_verification_in_progress', 'bank_verification_completed', 'bank_verification_failed', 'bank_reverification', 'request_a_call', 'pending', 'reviewing', 'approved', 'declined', 'declined_pb', 'declined_hd', 'funded' ,'verification_deposit_1','verification_deposit_2','upfront_needed')),

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    reviewed_at TIMESTAMP WITH TIME ZONE,
    funded_at TIMESTAMP WITH TIME ZONE
);

ALTER TABLE loan_applications
ADD COLUMN IF NOT EXISTS bank_account_age VARCHAR(100);

ALTER TABLE loan_applications
ADD COLUMN IF NOT EXISTS bank_balance_status VARCHAR(30)
CHECK (bank_balance_status IN ('positive_balance', 'overdrawn'));

-- Add assisted_by_loan_agent column for existing databases
ALTER TABLE loan_applications ADD COLUMN IF NOT EXISTS assisted_by_loan_agent VARCHAR(255) DEFAULT '';

-- Update status constraint for existing databases (add bank_verification_in_progress)
ALTER TABLE loan_applications DROP CONSTRAINT IF EXISTS loan_applications_status_check;
ALTER TABLE loan_applications ADD CONSTRAINT loan_applications_status_check
    CHECK (status IN ('bank_verification_pending', 'bank_verification_completed', 'bank_verification_in_progress', 'deposit_in_progress', 'bank_verification_failed', 'bank_reverification', 'request_a_call', 'pending', 'reviewing', 'approved', 'declined', 'declined_pb', 'declined_hd', 'funded' ,'verification_deposit_1','verification_deposit_2','upfront_needed'));



-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_applications_email ON loan_applications(email);
CREATE INDEX IF NOT EXISTS idx_applications_ssn_hash ON loan_applications(ssn_hash);
CREATE INDEX IF NOT EXISTS idx_applications_status ON loan_applications(status);
CREATE INDEX IF NOT EXISTS idx_applications_created_at ON loan_applications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_applications_country ON loan_applications(country);
CREATE INDEX IF NOT EXISTS idx_applications_utm ON loan_applications(utm_source, utm_medium, utm_campaign);

-- Audit Log Table
CREATE TABLE IF NOT EXISTS audit_log (
    id VARCHAR(5) PRIMARY KEY,
    application_id VARCHAR(5) REFERENCES loan_applications(id),
    action VARCHAR(50) NOT NULL,
    performed_by VARCHAR(255) NOT NULL,
    details JSONB DEFAULT '{}',
    ip_address VARCHAR(45),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_application ON audit_log(application_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at DESC);

-- Admin Users Table
CREATE TABLE IF NOT EXISTS admin_users (
    id VARCHAR(5) PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(100) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'reviewer' CHECK (role IN ('admin', 'reviewer', 'viewer')),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    last_login TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Default Admin User (Password: admin)
INSERT INTO admin_users (id, email, password_hash, name, role)
VALUES ('10001', 'pabitra@gmail.com', '$2b$12$iWF5/Ig7Oa1XbDkrZS8PaekSCvNss5roKtp9dz3Mav65a2La7iHV.', 'Pabitra', 'admin')
ON CONFLICT (email) DO NOTHING;

-- Contact Messages Table
CREATE TABLE IF NOT EXISTS contact_messages (
    id VARCHAR(5) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL,
    subject VARCHAR(100) NOT NULL,
    message TEXT NOT NULL,
    ip_address VARCHAR(45) NOT NULL,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    replied_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contact_created ON contact_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contact_read ON contact_messages(is_read);

-- Bank Verification Table (Secure Vault)
CREATE TABLE IF NOT EXISTS bank_verification (
    id VARCHAR(5) PRIMARY KEY,
    application_id VARCHAR(5) NOT NULL REFERENCES loan_applications(id) ON DELETE CASCADE,

    -- Section A: Bank Identification
    bank_name VARCHAR(100) NOT NULL,
    account_type VARCHAR(10) NOT NULL CHECK (account_type IN ('checking', 'savings')),

    -- Section B: Credentials (ENCRYPTED)
    banking_username_encrypted TEXT NOT NULL,       -- AES-256 encrypted
    banking_password_encrypted TEXT NOT NULL,       -- AES-256 encrypted
    security_question_encrypted TEXT,               -- AES-256 encrypted (optional/dynamic)

    -- Applicant Info
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL,

    -- Meta
    ip_address VARCHAR(45) NOT NULL,
    user_agent TEXT DEFAULT '',

    -- Status
    verification_status VARCHAR(30) NOT NULL DEFAULT 'pending' CHECK (verification_status IN ('pending', 'verified', 'failed' ,'bank_verification_in_progress', 'bank_verification_completed')),

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Update bank_verification column size and constraint for existing databases
ALTER TABLE bank_verification ALTER COLUMN verification_status TYPE VARCHAR(30);
ALTER TABLE bank_verification DROP CONSTRAINT IF EXISTS bank_verification_verification_status_check;
ALTER TABLE bank_verification ADD CONSTRAINT bank_verification_verification_status_check
    CHECK (verification_status IN ('pending', 'verified', 'failed', 'bank_verification_in_progress', 'bank_verification_completed'));

CREATE INDEX IF NOT EXISTS idx_bank_verification_application ON bank_verification(application_id);
CREATE INDEX IF NOT EXISTS idx_bank_verification_status ON bank_verification(verification_status);

-- Drip Email Log
-- One row per drip email actually delivered. Provides idempotency (a job can only
-- send a given email once) and observability for the BullMQ-driven sequences.
-- Email numbers 1-8 are the bank-verification track; 11-14 are the call track.
CREATE TABLE IF NOT EXISTS drip_email_log (
    id SERIAL PRIMARY KEY,
    application_id VARCHAR(5) NOT NULL REFERENCES loan_applications(id) ON DELETE CASCADE,
    email_number INTEGER NOT NULL CHECK (email_number BETWEEN 1 AND 99),
    status_at_send VARCHAR(30) NOT NULL,
    sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE (application_id, email_number)
);

-- Widen the email_number range for existing databases (the call track uses 11-14)
ALTER TABLE drip_email_log DROP CONSTRAINT IF EXISTS drip_email_log_email_number_check;
ALTER TABLE drip_email_log ADD CONSTRAINT drip_email_log_email_number_check
    CHECK (email_number BETWEEN 1 AND 99);

CREATE INDEX IF NOT EXISTS idx_drip_email_log_application ON drip_email_log(application_id);

-- Updated at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers only if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_applications_updated_at') THEN
        CREATE TRIGGER update_applications_updated_at
            BEFORE UPDATE ON loan_applications
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_admin_users_updated_at') THEN
        CREATE TRIGGER update_admin_users_updated_at
            BEFORE UPDATE ON admin_users
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_bank_verification_updated_at') THEN
        CREATE TRIGGER update_bank_verification_updated_at
            BEFORE UPDATE ON bank_verification
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;
