import { z } from "zod";

export const applicationSchema = z.object({
  firstName: z
    .string()
    .min(2, "First name must be at least 2 characters")
    .max(50),
  lastName: z
    .string()
    .min(2, "Last name must be at least 2 characters")
    .max(50),
  email: z.string().email("Please enter a valid email address"),
  phone: z.string().regex(
    /^\+?\d[\d\s().-]{8,15}$/,
    "Please enter a valid phone number"
  ),
  dateOfBirth: z.string().min(1, "Date of birth is required"),
  ssn: z
    .string()
    .min(1, "This field is required")
    .refine(
      (val) =>
        // US SSN: XXX-XX-XXXX
        /^\d{3}-?\d{2}-?\d{4}$/.test(val) ||
        // Canada SIN: XXX-XXX-XXX
        /^\d{3}-?\d{3}-?\d{3}$/.test(val) ||
        // India Aadhaar: 12 digits
        /^\d{12}$/.test(val) ||
        // India PAN: ABCDE1234F
        /^[A-Z]{5}\d{4}[A-Z]$/i.test(val),
      { message: "Please enter a valid identification number" }
    ),
  driverLicenseNumber: z.string().min(4).max(20),
  driverLicenseState: z.string().min(2),
  streetAddress: z.string().min(5).max(100),
  city: z.string().min(2).max(50),
  state: z.string().min(2),
  zipCode: z.string().regex(
    /^(\d{5}(-\d{4})?|[A-Za-z]\d[A-Za-z]\s?\d[A-Za-z]\d|\d{6})$/,
    "Invalid postal code"
  ),
  country: z.enum(["US", "CA", "IN"]),
  employmentStatus: z.enum(["employed", "self-employed", "retired", "other"]),
  employerName: z.string().min(2).max(100),
  jobTitle: z.string().min(2).max(50),
  monthlyIncome: z.number().min(500).max(1000000),
  yearsEmployed: z.number().min(0).max(50),
  loanAmount: z.number().min(1000).max(50000),
  loanPurpose: z.enum([
    "debt-consolidation",
    "home-improvement",
    "medical",
    "auto",
    "business",
    "education",
    "other",
  ]),
  loanTerm: z.number().refine((v) => [12, 24, 36, 48, 60].includes(v), {
    message: "Invalid loan term",
  }),
  routingNumber: z
    .string()
    .min(1)
    .refine(
      (val) => /^\d{9}$/.test(val) || /^[A-Z]{4}0[A-Z0-9]{6}$/i.test(val),
      { message: "Enter a valid routing number or IFSC code" }
    ),
  bankName: z.string().min(2),
  accountNumber: z.string().min(6).max(20).regex(/^\d+$/),
  accountType: z.enum(["checking", "savings"]),
  tcpaConsent: z.literal(true),
  privacyConsent: z.literal(true),
  creditCheckConsent: z.literal(true),
  // Optional UTM fields
  utmSource: z.string().optional().default(""),
  utmMedium: z.string().optional().default(""),
  utmCampaign: z.string().optional().default(""),
  utmContent: z.string().optional().default(""),
  leadId: z.string().optional().default(""),
});

export const contactSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  subject: z.string().min(2).max(100),
  message: z.string().min(10).max(2000),
});

export const adminLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  action: z.string().optional(),
  setupKey: z.string().optional(),
  name: z.string().optional(),
});

export function sanitizeInput(input: string): string {
  return input
    .replace(/[<>]/g, "")
    .replace(/javascript:/gi, "")
    .replace(/on\w+=/gi, "")
    .trim();
}
