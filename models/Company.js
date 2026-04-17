const mongoose = require('mongoose');

const companySchema = new mongoose.Schema({
  name: { type: String, required: true, default: 'Excerpt Technologies Pvt Ltd' },
  tagline: { type: String },
  gstin: { type: String },
  pan: { type: String },
  cin: { type: String },
  address: {
    line1: { type: String },
    line2: { type: String },
    city: { type: String },
    state: { type: String },
    pincode: { type: String },
    country: { type: String, default: 'India' }
  },
  phone: { type: String },
  email: { type: String },
  website: { type: String },
  logo: { type: String },
  qrCode: { type: String },
  signature: { type: String },
  bank: {
    bankName: { type: String },
    accountNumber: { type: String },
    ifscCode: { type: String },
    accountType: { type: String, enum: ['Current', 'Savings'], default: 'Current' },
    branchName: { type: String },
    upiId: { type: String },
    upiQr: { type: String }
  },
  invoiceSettings: {
    prefix: { type: String, default: 'INV' },
    nextNumber: { type: Number, default: 1001 },
    format: { type: String, default: 'PREFIX-YEAR-NUMBER' },
    dueDays: { type: Number, default: 30 },
    defaultTemplate: { type: String, default: 'minimal_white' },
    showLogo: { type: Boolean, default: true },
    showSignature: { type: Boolean, default: true },
    showQrCode: { type: Boolean, default: true },
    showBankDetails: { type: Boolean, default: true }
  },
  quotationSettings: {
    prefix: { type: String, default: 'QT' },
    nextNumber: { type: Number, default: 1001 },
    validityDays: { type: Number, default: 15 },
    defaultTemplate: { type: String, default: 'minimal_white' }
  },
  gstSettings: {
    gstPercent: { type: Number, default: 18 },
    cgstPercent: { type: Number, default: 9 },
    sgstPercent: { type: Number, default: 9 },
    igstPercent: { type: Number, default: 18 }
  },
  termsAndConditions: {
    invoice: { type: String, default: '1. Payment due within 30 days of invoice date.\n2. Late payments may incur a 2% monthly interest charge.\n3. All disputes subject to local jurisdiction.' },
    quotation: { type: String, default: '1. Quotation valid for 15 days from issue date.\n2. Prices may change without notice after validity period.\n3. 50% advance payment required to start work.' }
  },
  notes: { type: String },
  socialLinks: {
    linkedin: String,
    twitter: String,
    facebook: String,
    instagram: String
  },
  financialYear: {
    startMonth: { type: Number, default: 4 },
    endMonth: { type: Number, default: 3 }
  }
}, { timestamps: true });

module.exports = mongoose.model('Company', companySchema);
