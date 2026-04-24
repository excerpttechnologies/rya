const mongoose = require('mongoose');

// ========== LEAD MODEL ==========
const leadSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: String,
  phone: String,
  companyName: String,
  source: { type: String, enum: ['website', 'referral', 'social', 'cold_call', 'email', 'exhibition', 'other'], default: 'other' },
  category: String,
  shortRequirement: String,
  status: { type: String, enum: ['new', 'contacted', 'follow_up', 'quotation_sent', 'converted', 'rejected', 'not_interested'], default: 'new' },
  priority: { type: String, enum: ['low', 'medium', 'high', 'urgent'], default: 'medium' },
  followUps: [{ date: Date, note: String, by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, outcome: String }],
  aiScore: { conversionScore: Number, priority: String, suggestedAction: String },
  estimatedValue: Number,
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  convertedCustomer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
  convertedAt: Date,
  rejectedReason: String,
  notes: String,
  tags: [String],
  nextFollowUpDate: Date,
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

// ========== SUPPLIER MODEL ==========
const supplierSchema = new mongoose.Schema({
  supplierCode: { type: String, unique: true },
  name: { type: String, required: true },
  companyName: String,
  email: String,
  phone: String,
  alternatePhone: String,
  address: { line1: String, line2: String, city: String, state: String, pincode: String, country: { type: String, default: 'India' } },
  gstin: String,
  pan: String,
  category: { type: String, enum: ['Hardware', 'Software', 'Cloud Services', 'Office Supplies', 'Freelancer', 'Agency', 'Consultant', 'Other'], default: 'Other' },
  bank: { bankName: String, accountNumber: String, ifscCode: String, accountType: String },
  paymentTerms: String,
  creditLimit: Number,
  rating: { type: Number, min: 1, max: 5 },
  isActive: { type: Boolean, default: true },
  isCancelled: { type: Boolean, default: false },
  cancelReason: String,
  totalPurchases: { type: Number, default: 0 },
  notes: String,
  tags: [String]
}, { timestamps: true });

supplierSchema.pre('save', async function (next) {
  if (!this.supplierCode) {
    const count = await this.constructor.countDocuments();
    this.supplierCode = `SUP-${String(count + 1001).padStart(4, '0')}`;
  }
  next();
});

// ========== PURCHASE MODEL ==========
const purchaseSchema = new mongoose.Schema({
  purchaseNumber: { type: String, unique: true },
  supplier: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier', required: true },
  supplierSnapshot: Object,
  purchaseDate: { type: Date, default: Date.now },
  items: [{
    name: String, description: String, quantity: Number,
    unitPrice: Number, totalPrice: Number, hsnCode: String, unit: String
  }],
  pricing: {
    subtotal: Number, gstPercent: { type: Number, default: 18 },
    gstAmount: Number, additionalCharges: Number, grandTotal: Number
  },
  paymentStatus: {
    type: String, enum: ['unpaid', 'partial', 'paid'], default: 'unpaid'
  },
  paidAmount: { type: Number, default: 0 },
  documents: [{ name: String, url: String, uploadedAt: Date }],
  deliveryDate: Date,
  notes: String,
  isCancelled: { type: Boolean, default: false },
  cancelReason: String,
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

purchaseSchema.pre('save', async function (next) {
  if (!this.purchaseNumber) {
    const count = await this.constructor.countDocuments();
    this.purchaseNumber = `PUR-${new Date().getFullYear()}-${String(count + 1001).padStart(4, '0')}`;
  }
  let subtotal = 0;
  this.items.forEach(item => {
    item.totalPrice = item.quantity * item.unitPrice;
    subtotal += item.totalPrice;
  });
  this.pricing.subtotal = subtotal;
  this.pricing.gstAmount = (subtotal * (this.pricing.gstPercent || 18)) / 100;
  this.pricing.grandTotal = subtotal + this.pricing.gstAmount + (this.pricing.additionalCharges || 0);
  next();
});

// ========== EXPENSE MODEL ==========
const expenseSchema = new mongoose.Schema({
  expenseNumber: String,
  category: {
    type: String,
    enum: ['Rent', 'Electricity', 'Water', 'Internet', 'Xerox', 'Certificates', 'Salary', 'Marketing', 'Travel', 'Food', 'Equipment', 'Software', 'Maintenance', 'Legal', 'Misc'],
    default: 'Misc'
  },
  customCategory: String,
  description: String,
  amount: { type: Number, required: true },
  date: { type: Date, default: Date.now },
  paymentMethod: { type: String, enum: ['cash', 'bank_transfer', 'upi', 'cheque', 'card'], default: 'cash' },
  receipt: String,
  vendor: String,
  isRecurring: { type: Boolean, default: false },
  recurringFrequency: { type: String, enum: ['daily', 'weekly', 'monthly', 'yearly'] },
  aiCategorized: { type: Boolean, default: false },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'approved' },
  notes: String,
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

// ========== EMPLOYEE MODEL ==========
const employeeSchema = new mongoose.Schema({
  employeeCode: { type: String, unique: true },
  name: { type: String, required: true },
  email: { type: String, unique: true },
  phone: String,
  alternatePhone: String,
  department: { type: String, required: true },
  designation: { type: String, required: true },
  joiningDate: { type: Date, required: true },
  employmentType: { type: String, enum: ['full_time', 'part_time', 'contract', 'intern'], default: 'full_time' },
  baseSalary: { type: Number, required: true },
  bankDetails: { bankName: String, accountNumber: String, ifscCode: String },
  address: { line1: String, city: String, state: String, pincode: String },
  emergencyContact: { name: String, phone: String, relationship: String },
  documents: [{ type: String, url: String, name: String }],
  avatar: String,
  pan: String,
  aadhaar: String,
  pfNumber: String,
  esiNumber: String,
  isActive: { type: Boolean, default: true },
  resignationDate: Date,
  exitReason: String,
  skills: [String],
  performanceScore: { type: Number, min: 0, max: 100 },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

employeeSchema.pre('save', async function(next) {
  if (!this.employeeCode) {
    const lastEmployee = await this.constructor
      .findOne({})
      .sort({ createdAt: -1 });

    let nextNumber = 1001;

    if (lastEmployee && lastEmployee.employeeCode) {
      const num = parseInt(
        lastEmployee.employeeCode.split('-')[1]
      );
      nextNumber = num + 1;
    }

    this.employeeCode = `EMP-${nextNumber}`;
  }

  next();
});

// ========== SALARY MODEL ==========
const salarySchema = new mongoose.Schema({
  employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
  month: { type: Number, required: true },
  year: { type: Number, required: true },
  workingDays: { type: Number, default: 26 },
  presentDays: { type: Number, default: 26 },
  fullLeaves: { type: Number, default: 0 },
  halfLeaves: { type: Number, default: 0 },
  baseSalary: { type: Number, required: true },
  perDaySalary: Number,
  leaveDeduction: { type: Number, default: 0 },
  incentives: { type: Number, default: 0 },
  bonus: { type: Number, default: 0 },
  overtime: { type: Number, default: 0 },
  allowances: [{ type: String, amount: Number }],
  deductions: [{ type: String, amount: Number }],
  pf: { type: Number, default: 0 },
  esi: { type: Number, default: 0 },
  tds: { type: Number, default: 0 },
  grossSalary: Number,
  netSalary: Number,
  status: { type: String, enum: ['pending', 'processed', 'paid'], default: 'pending' },
  paidDate: Date,
  paymentMethod: String,
  transactionRef: String,
  notes: String,
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

salarySchema.pre('save', function (next) {
  this.perDaySalary = this.baseSalary / (this.workingDays || 26);
  const leaveDeduction = (this.fullLeaves * this.perDaySalary) + (this.halfLeaves * this.perDaySalary * 0.5);
  this.leaveDeduction = leaveDeduction;
  const allowancesTotal = (this.allowances || []).reduce((s, a) => s + a.amount, 0);
  this.grossSalary = this.baseSalary - leaveDeduction + this.incentives + this.bonus + this.overtime + allowancesTotal;
  const deductionsTotal = (this.deductions || []).reduce((s, d) => s + d.amount, 0);
  this.netSalary = this.grossSalary - this.pf - this.esi - this.tds - deductionsTotal;
  next();
});

// ========== PRODUCT MODEL ==========
const productSchema = new mongoose.Schema({
  productCode: { type: String, unique: true },
  softwareName: { type: String, required: true },
  description: String,
  technologyUsed: [String],
  developedBy: String,
  category: { type: String, enum: ['Web App', 'Mobile App', 'Desktop App', 'API', 'SaaS', 'Plugin', 'Other'], default: 'Web App' },
  launchDate: Date,
  version: String,
  pricing: {
    fullSystem: Number,
    subscriptionMonthly: Number,
    subscriptionYearly: Number,
    perUser: Number,
    customPricingNotes: String
  },
  features: [String],
  clients: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Customer' }],
  status: { type: String, enum: ['active', 'beta', 'deprecated', 'development'], default: 'development' },
  documentation: String,
  repositoryUrl: String,
  demoUrl: String,
  aiDemandScore: Number,
  aiPricingSuggestion: Object
}, { timestamps: true });

productSchema.pre('save', async function (next) {
  if (!this.productCode) {
    const count = await this.constructor.countDocuments();
    this.productCode = `PROD-${String(count + 101).padStart(3, '0')}`;
  }
  next();
});

// ========== PROJECT MODEL ==========
const projectSchema = new mongoose.Schema({
  projectCode: { type: String, unique: true },
  name: { type: String, required: true },
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
  invoice: { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice' },
  description: String,
  category: String,
  startDate: { type: Date, required: true },
  deadline: { type: Date, required: true },
  actualEndDate: Date,
  status: { type: String, enum: ['not_started', 'in_progress', 'on_hold', 'completed', 'cancelled', 'overdue'], default: 'not_started' },
  priority: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'medium' },
  totalValue: Number,
  installments: [{
    installmentNumber: Number,
    description: String,
    amount: Number,
    dueDate: Date,
    status: { type: String, enum: ['pending', 'partial', 'paid'], default: 'pending' },
    paidAmount: { type: Number, default: 0 },
    paidDate: Date
  }],
  team: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Employee' }],
  manager: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  tasks: [{
    title: String, description: String,
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
    status: { type: String, enum: ['todo', 'in_progress', 'review', 'done'], default: 'todo' },
    priority: String, dueDate: Date, completedAt: Date, tags: [String]
  }],
  updates: [{ date: Date, content: String, by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, type: String }],
  completionPercentage: { type: Number, default: 0 },
  aiRiskScore: Number,
  aiDelayPrediction: String,
  techStack: [String],
  githubUrl: String
}, { timestamps: true });

projectSchema.pre('save', async function (next) {
  if (!this.projectCode) {
    const count = await this.constructor.countDocuments();
    this.projectCode = `PROJ-${new Date().getFullYear()}-${String(count + 101).padStart(3, '0')}`;
  }
  next();
});

// ========== SCRUM MODEL ==========
const scrumEntrySchema = new mongoose.Schema({
  date: { type: Date, required: true },
  type: { type: String, enum: ['morning', 'evening'], required: true },
  scrumMaster: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },
  entries: [{
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
    morningData: {
      yesterdayWork: String,
      todayPlan: String,
      blockers: String,
      plannedTasks: [{ task: String, estimatedHours: Number }]
    },
    eveningData: {
      completedWork: String,
      pendingWork: String,
      status: { type: String, enum: ['completed', 'partial', 'not_done'], default: 'partial' },
      completedTasks: [{ task: String, hoursSpent: Number }],
      challenges: String
    },
    accuracyScore: { type: Number, min: 0, max: 100 },
    productivityScore: { type: Number, min: 0, max: 100 }
  }],
  sprint: { number: Number, startDate: Date, endDate: Date },
  notes: String,
  overallTeamScore: Number,
  aiInsights: String
}, { timestamps: true });

// ========== QUOTATION MODEL ==========
const quotationSchema = new mongoose.Schema({
  quotationNumber: { type: String, unique: true, required: true },
  quotationTitle: { type: String, default: '' },
  customerAddress: { type: String, default: '' },
  quotationDate: { type: Date, default: Date.now },
  validUntil: Date,
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
  customerSnapshot: Object,
  parts: [{
    partLabel: String, partName: String,
    items: [{ description: String, quantity: Number, unitPrice: Number, totalPrice: Number }],
    partTotal: Number
  }],
  pricing: {
    subtotal: Number, discount: Number, discountType: String,
    discountAmount: Number, taxableAmount: Number,
    gstType: { type: String, default: 'GST' },
    cgstPercent: { type: Number, default: 9 }, sgstPercent: { type: Number, default: 9 },
    igstPercent: { type: Number, default: 18 },
    cgstAmount: Number, sgstAmount: Number, igstAmount: Number,
    totalGst: Number, grandTotal: Number, amountInWords: String
  },
  template: { type: String, default: 'minimal_white' },
  status: { type: String, enum: ['draft', 'sent', 'accepted', 'rejected', 'expired', 'converted'], default: 'draft' },
  convertedToInvoice: { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice' },
  convertedAt: Date,
  notes: String,
  features: String,
  termsAndConditions: String,
  aiGenerated: { type: Boolean, default: false },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

// ========== LEDGER MODEL ==========
const ledgerEntrySchema = new mongoose.Schema({
  date: { type: Date, default: Date.now },
  type: { type: String, enum: ['debit', 'credit'], required: true },
  entityType: { type: String, enum: ['customer', 'supplier'], required: true },
  entity: { type: mongoose.Schema.Types.ObjectId, refPath: 'entityModel' },
  entityModel: { type: String, enum: ['Customer', 'Supplier'] },
  entityName: String,
  description: { type: String, required: true },
  amount: { type: Number, required: true },
  balance: Number,
  referenceType: { type: String, enum: ['invoice', 'payment', 'purchase', 'expense', 'adjustment', 'other'] },
  referenceId: String,
  referenceNumber: String,
  paymentMethod: String,
  notes: String,
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

module.exports = {
  Lead: mongoose.model('Lead', leadSchema),
  Supplier: mongoose.model('Supplier', supplierSchema),
  Purchase: mongoose.model('Purchase', purchaseSchema),
  Expense: mongoose.model('Expense', expenseSchema),
  Employee: mongoose.model('Employee', employeeSchema),
  Salary: mongoose.model('Salary', salarySchema),
  Product: mongoose.model('Product', productSchema),
  Project: mongoose.model('Project', projectSchema),
  ScrumEntry: mongoose.model('ScrumEntry', scrumEntrySchema),
  Quotation: mongoose.model('Quotation', quotationSchema),
  LedgerEntry: mongoose.model('LedgerEntry', ledgerEntrySchema)
};
