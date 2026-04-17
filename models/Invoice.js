const mongoose = require('mongoose');

const invoiceItemSchema = new mongoose.Schema({
  description: { type: String, required: true },
  partLabel: { type: String },
  quantity: { type: Number, default: 1 },
  unitPrice: { type: Number, required: true },
  totalPrice: { type: Number },
  hsnCode: { type: String }
});

const invoiceSchema = new mongoose.Schema({
  invoiceNumber: { type: String, unique: true, required: true },
  invoiceDate: { type: Date, default: Date.now },
  dueDate: { type: Date },
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
  customerSnapshot: {
    name: String, companyName: String, email: String, phone: String,
    address: Object, gstin: String
  },
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company' },
  companySnapshot: Object,
  parts: [{
    partLabel: String,
    partName: String,
    items: [invoiceItemSchema],
    partTotal: Number
  }],
  pricing: {
    subtotal: { type: Number, default: 0 },
    discountType: { type: String, enum: ['fixed', 'percentage'], default: 'fixed' },
    discount: { type: Number, default: 0 },
    discountAmount: { type: Number, default: 0 },
    taxableAmount: { type: Number, default: 0 },
    gstType: { type: String, enum: ['GST', 'IGST'], default: 'GST' },
    cgstPercent: { type: Number, default: 9 },
    sgstPercent: { type: Number, default: 9 },
    igstPercent: { type: Number, default: 18 },
    cgstAmount: { type: Number, default: 0 },
    sgstAmount: { type: Number, default: 0 },
    igstAmount: { type: Number, default: 0 },
    totalGst: { type: Number, default: 0 },
    additionalCharges: [{ description: String, amount: Number }],
    roundOff: { type: Number, default: 0 },
    grandTotal: { type: Number, default: 0 },
    amountInWords: String
  },
  template: {
    type: String,
    enum: ['minimal_white', 'modern_gradient', 'dark_professional', 'classic_corporate', 'clean_accounting'],
    default: 'minimal_white'
  },
  status: {
    type: String,
    enum: ['draft', 'sent', 'paid', 'partial', 'overdue', 'cancelled'],
    default: 'draft'
  },
  paymentStatus: {
    totalAmount: { type: Number, default: 0 },
    paidAmount: { type: Number, default: 0 },
    pendingAmount: { type: Number, default: 0 },
    payments: [{
      amount: Number,
      date: Date,
      method: { type: String, enum: ['cash', 'bank_transfer', 'upi', 'cheque', 'card', 'other'] },
      reference: String,
      note: String
    }]
  },
  notes: String,
  termsAndConditions: String,
  fromQuotation: { type: mongoose.Schema.Types.ObjectId, ref: 'Quotation' },
  fromProject: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },
  aiGenerated: { type: Boolean, default: false },
  sentAt: Date,
  viewedAt: Date,
  paidAt: Date,
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  isCancelled: { type: Boolean, default: false },
  cancelReason: String
}, { timestamps: true });

// Calculate totals before save
invoiceSchema.pre('save', function (next) {
  let subtotal = 0;
  this.parts.forEach(part => {
    let partTotal = 0;
    part.items.forEach(item => {
      item.totalPrice = (item.quantity || 1) * item.unitPrice;
      partTotal += item.totalPrice;
    });
    part.partTotal = partTotal;
    subtotal += partTotal;
  });
  this.pricing.subtotal = subtotal;
  const discountAmount = this.pricing.discountType === 'percentage'
    ? (subtotal * this.pricing.discount) / 100
    : this.pricing.discount;
  this.pricing.discountAmount = discountAmount;
  this.pricing.taxableAmount = subtotal - discountAmount;
  if (this.pricing.gstType === 'IGST') {
    this.pricing.igstAmount = (this.pricing.taxableAmount * this.pricing.igstPercent) / 100;
    this.pricing.totalGst = this.pricing.igstAmount;
  } else {
    this.pricing.cgstAmount = (this.pricing.taxableAmount * this.pricing.cgstPercent) / 100;
    this.pricing.sgstAmount = (this.pricing.taxableAmount * this.pricing.sgstPercent) / 100;
    this.pricing.totalGst = this.pricing.cgstAmount + this.pricing.sgstAmount;
  }
  const additionalTotal = this.pricing.additionalCharges.reduce((s, c) => s + c.amount, 0);
  const rawTotal = this.pricing.taxableAmount + this.pricing.totalGst + additionalTotal;
  this.pricing.roundOff = Math.round(rawTotal) - rawTotal;
  this.pricing.grandTotal = Math.round(rawTotal);
  this.paymentStatus.totalAmount = this.pricing.grandTotal;
  this.paymentStatus.pendingAmount = this.pricing.grandTotal - (this.paymentStatus.paidAmount || 0);
  next();
});

module.exports = mongoose.model('Invoice', invoiceSchema);
