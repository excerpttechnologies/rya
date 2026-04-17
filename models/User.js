const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true, minlength: 6, select: false },
  role: {
    type: String,
    enum: ['super_admin', 'admin', 'manager', 'employee', 'scrum_master', 'accountant', 'hr'],
    default: 'employee'
  },
  permissions: {
    dashboard: { type: Boolean, default: false },
    customers: { type: Boolean, default: false },
    invoices: { type: Boolean, default: false },
    quotations: { type: Boolean, default: false },
    payments: { type: Boolean, default: false },
    suppliers: { type: Boolean, default: false },
    purchases: { type: Boolean, default: false },
    expenses: { type: Boolean, default: false },
    employees: { type: Boolean, default: false },
    salaries: { type: Boolean, default: false },
    products: { type: Boolean, default: false },
    ledger: { type: Boolean, default: false },
    reports: { type: Boolean, default: false },
    projects: { type: Boolean, default: false },
    scrum: { type: Boolean, default: false },
    leads: { type: Boolean, default: false },
    company: { type: Boolean, default: false },
    users: { type: Boolean, default: false },
    ai: { type: Boolean, default: false }
  },
  avatar: { type: String, default: null },
  phone: { type: String },
  department: { type: String },
  designation: { type: String },
  isActive: { type: Boolean, default: true },
  lastLogin: { type: Date },
  loginHistory: [{
    timestamp: Date,
    ip: String,
    userAgent: String
  }],
  preferences: {
    theme: { type: String, enum: ['light', 'dark', 'system'], default: 'system' },
    language: { type: String, default: 'en' },
    notifications: { type: Boolean, default: true },
    aiSuggestions: { type: Boolean, default: true }
  },
  twoFactorEnabled: { type: Boolean, default: false },
  resetPasswordToken: String,
  resetPasswordExpire: Date,
}, { timestamps: true });

// Encrypt password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Set permissions based on role
userSchema.pre('save', function (next) {
  const rolePermissions = {
    super_admin: Object.keys(this.permissions).reduce((acc, key) => ({ ...acc, [key]: true }), {}),
    admin: { dashboard: true, customers: true, invoices: true, quotations: true, payments: true, suppliers: true, purchases: true, expenses: true, employees: true, salaries: true, products: true, ledger: true, reports: true, projects: true, scrum: true, leads: true, company: true, users: false, ai: true },
    accountant: { dashboard: true, invoices: true, payments: true, expenses: true, ledger: true, reports: true, suppliers: true, purchases: true, ai: true },
    hr: { dashboard: true, employees: true, salaries: true, ai: true },
    scrum_master: { scrum: true },
    manager: { dashboard: true, customers: true, leads: true, projects: true, reports: true, ai: true },
    employee: { dashboard: true }
  };

  if (rolePermissions[this.role]) {
    Object.assign(this.permissions, rolePermissions[this.role]);
  }
  next();
});

// Match password
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Generate JWT
userSchema.methods.getSignedJwtToken = function () {
  return jwt.sign(
    { id: this._id, role: this.role, permissions: this.permissions },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE || '7d' }
  );
};

module.exports = mongoose.model('User', userSchema);
