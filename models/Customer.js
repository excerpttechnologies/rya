const mongoose = require('mongoose');

const requirementItemSchema = new mongoose.Schema({
  description: { type: String, required: true },
  quantity: { type: Number, default: 1 },
  unitPrice: { type: Number, required: true },
  totalPrice: { type: Number }
}, { _id: true });

const requirementPartSchema = new mongoose.Schema({
  partLabel: { type: String, required: true },
  partName: { type: String },
  items: [requirementItemSchema],
  partTotal: { type: Number, default: 0 }
}, { _id: true });

const customerSchema = new mongoose.Schema({
  customerCode: { type: String, unique: true },
  name: { type: String, required: true, trim: true },
  companyName: { type: String, trim: true },
  email: { type: String, lowercase: true, trim: true },
  phone: { type: String },
  alternatePhone: { type: String },
  address: {
    line1: String,
    line2: String,
    city: String,
    state: String,
    pincode: String,
    country: { type: String, default: 'India' }
  },
  gstin: { type: String },
  pan: { type: String },
  category: {
    type: String,
    enum: ['Website', 'Ecommerce', 'CRM', 'E-learning', 'ERP', 'WhatsApp Service', 'GeekyChat', 'Eva Lite ERP', 'Static Website', 'Dynamic Website', 'Mobile App', 'API Integration', 'Other'],
    default: 'Other'
  },
  categoryCustom: { type: String },
  requirements: [requirementPartSchema],
  pricing: {
    subtotal: { type: Number, default: 0 },
    gstPercent: { type: Number, default: 18 },
    gstAmount: { type: Number, default: 0 },
    additionalCharges: { type: Number, default: 0 },
    additionalChargesDesc: { type: String },
    maintenanceYearly: { type: Number, default: 0 },
    addOns: [{
      description: String,
      amount: Number
    }],
    discount: { type: Number, default: 0 },
    discountType: { type: String, enum: ['fixed', 'percentage'], default: 'fixed' },
    totalAmount: { type: Number, default: 0 }
  },
  status: {
    type: String,
    enum: ['lead', 'prospect', 'active', 'inactive', 'cancelled'],
    default: 'lead'
  },
  source: {
    type: String,
    enum: ['website', 'referral', 'social_media', 'direct', 'cold_call', 'email', 'other'],
    default: 'direct'
  },
  aiScore: {
    conversionProbability: { type: Number, min: 0, max: 100 },
    healthScore: { type: Number, min: 0, max: 100 },
    riskLevel: { type: String, enum: ['low', 'medium', 'high'] },
    lastAnalyzed: Date
  },
  notes: { type: String },
  tags: [String],
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  isCancelled: { type: Boolean, default: false },
  cancelledReason: { type: String },
  cancelledAt: { type: Date },
  totalRevenue: { type: Number, default: 0 },
  totalPaid: { type: Number, default: 0 },
  totalPending: { type: Number, default: 0 },
  lastActivityAt: { type: Date }
}, { timestamps: true });

// Auto-generate customer code
customerSchema.pre('save', async function (next) {
  if (!this.customerCode) {
    const lastCustomer = await this.constructor
      .findOne({})
      .sort({ createdAt: -1 });

    let nextNumber = 1001;

    if (lastCustomer && lastCustomer.customerCode) {
      const num = parseInt(lastCustomer.customerCode.split('-')[1]);
      nextNumber = num + 1;
    }

    this.customerCode = `CUST-${nextNumber}`;
  }

  // Auto-calculate totals
  let subtotal = 0;

  this.requirements.forEach(part => {
    let partTotal = 0;

    part.items.forEach(item => {
      item.totalPrice = item.quantity * item.unitPrice;
      partTotal += item.totalPrice;
    });

    part.partTotal = partTotal;
    subtotal += partTotal;
  });

  this.pricing.subtotal = subtotal;

  const discountAmount =
    this.pricing.discountType === 'percentage'
      ? (subtotal * this.pricing.discount) / 100
      : this.pricing.discount;

  const afterDiscount = subtotal - discountAmount;

  this.pricing.gstAmount =
    (afterDiscount * this.pricing.gstPercent) / 100;

  const addOnsTotal = this.pricing.addOns.reduce(
    (sum, a) => sum + a.amount,
    0
  );

  this.pricing.totalAmount =
    afterDiscount +
    this.pricing.gstAmount +
    this.pricing.additionalCharges +
    addOnsTotal;

  this.lastActivityAt = new Date();

  next();
});

module.exports = mongoose.model('Customer', customerSchema);
