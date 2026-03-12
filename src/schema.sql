-- Creek Lend Database Schema
-- PostgreSQL

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Loan Applications Table
CREATE TABLE loan_applications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

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
    account_type VARCHAR(10) NOT NULL CHECK (account_type IN ('checking', 'savings')),

    -- UTM Tracking
    utm_source VARCHAR(255) DEFAULT '',
    utm_medium VARCHAR(255) DEFAULT '',
    utm_campaign VARCHAR(255) DEFAULT '',
    utm_content VARCHAR(255) DEFAULT '',

    -- Consent
    tcpa_consent BOOLEAN NOT NULL DEFAULT FALSE,
    privacy_consent BOOLEAN NOT NULL DEFAULT FALSE,
    credit_check_consent BOOLEAN NOT NULL DEFAULT FALSE,

    -- Meta
    ip_address VARCHAR(45) NOT NULL,
    user_agent TEXT DEFAULT '',
    lead_id VARCHAR(255) DEFAULT '',       -- Jornaya/TrustedForm
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewing', 'approved', 'declined', 'funded')),

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    reviewed_at TIMESTAMP WITH TIME ZONE,
    funded_at TIMESTAMP WITH TIME ZONE
);

-- Indexes for common queries
CREATE INDEX idx_applications_email ON loan_applications(email);
CREATE INDEX idx_applications_ssn_hash ON loan_applications(ssn_hash);
CREATE INDEX idx_applications_status ON loan_applications(status);
CREATE INDEX idx_applications_created_at ON loan_applications(created_at DESC);
CREATE INDEX idx_applications_country ON loan_applications(country);
CREATE INDEX idx_applications_utm ON loan_applications(utm_source, utm_medium, utm_campaign);

-- Audit Log Table
CREATE TABLE audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    application_id UUID REFERENCES loan_applications(id),
    action VARCHAR(50) NOT NULL,
    performed_by VARCHAR(255) NOT NULL,
    details JSONB DEFAULT '{}',
    ip_address VARCHAR(45),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_application ON audit_log(application_id);
CREATE INDEX idx_audit_created ON audit_log(created_at DESC);

-- Admin Users Table
CREATE TABLE admin_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(100) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'reviewer' CHECK (role IN ('admin', 'reviewer', 'viewer')),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    last_login TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Contact Messages Table
CREATE TABLE contact_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL,
    subject VARCHAR(100) NOT NULL,
    message TEXT NOT NULL,
    ip_address VARCHAR(45) NOT NULL,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    replied_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_contact_created ON contact_messages(created_at DESC);
CREATE INDEX idx_contact_read ON contact_messages(is_read);

-- Updated at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_applications_updated_at
    BEFORE UPDATE ON loan_applications
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_admin_users_updated_at
    BEFORE UPDATE ON admin_users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
