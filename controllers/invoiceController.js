const Invoice = require('../models/Invoice');
const Customer = require('../models/Customer');
const Company = require('../models/Company');
const { Quotation, LedgerEntry } = require('../models/index');
const aiService = require('../services/aiService');

const getNextInvoiceNumber = async () => {
  const company = await Company.findOne();
  const settings = company?.invoiceSettings || { prefix: 'INV', nextNumber: 1001 };
  const year = new Date().getFullYear();
  const number = `${settings.prefix}-${year}-${settings.nextNumber}`;
  if (company) { company.invoiceSettings.nextNumber += 1; await company.save(); }
  return number;
};

exports.getInvoices = async (req, res) => {
  const { page = 1, limit = 20, search, status, customer, sort = '-createdAt', startDate, endDate } = req.query;
  const query = { isCancelled: false };
  if (search) {
    const r = new RegExp(search, 'i');
    query.$or = [{ invoiceNumber: r }, { 'customerSnapshot.name': r }, { 'customerSnapshot.companyName': r }];
  }
  if (status) query.status = status;
  if (customer) query.customer = customer;
  if (startDate || endDate) {
    query.invoiceDate = {};
    if (startDate) query.invoiceDate.$gte = new Date(startDate);
    if (endDate) query.invoiceDate.$lte = new Date(endDate);
  }
  const total = await Invoice.countDocuments(query);
  const invoices = await Invoice.find(query).sort(sort).skip((page - 1) * limit).limit(parseInt(limit)).populate('customer', 'name companyName email').populate('createdBy', 'name');
  res.json({ success: true, data: invoices, pagination: { total, page: parseInt(page), pages: Math.ceil(total / limit) } });
};

exports.getInvoice = async (req, res) => {
  const invoice = await Invoice.findById(req.params.id).populate('customer').populate('createdBy', 'name');
  if (!invoice) return res.status(404).json({ success: false, message: 'Invoice not found' });
  const company = await Company.findOne();
  res.json({ success: true, data: { invoice, company } });
};

exports.createInvoice = async (req, res) => {
  const customer = await Customer.findById(req.body.customer);
  if (!customer) return res.status(404).json({ success: false, message: 'Customer not found' });
  const company = await Company.findOne();
  const invoiceNumber = await getNextInvoiceNumber();
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + (company?.invoiceSettings?.dueDays || 30));

  const invoice = await Invoice.create({
    ...req.body,
    invoiceNumber,
    dueDate: req.body.dueDate || dueDate,
    customerSnapshot: { name: customer.name, companyName: customer.companyName, email: customer.email, phone: customer.phone, address: customer.address, gstin: customer.gstin },
    companySnapshot: company ? company.toObject() : {},
    createdBy: req.user.id
  });

  // Add ledger entry
  await LedgerEntry.create({
    date: new Date(), type: 'debit', entityType: 'customer', entity: customer._id,
    entityModel: 'Customer', entityName: customer.name,
    description: `Invoice ${invoiceNumber} created`, amount: invoice.pricing.grandTotal,
    referenceType: 'invoice', referenceId: invoice._id, referenceNumber: invoiceNumber,
    createdBy: req.user.id
  });

  res.status(201).json({ success: true, data: invoice, message: 'Invoice created successfully' });
};

exports.updateInvoice = async (req, res) => {
  const invoice = await Invoice.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!invoice) return res.status(404).json({ success: false, message: 'Invoice not found' });
  res.json({ success: true, data: invoice, message: 'Invoice updated' });
};

exports.recordPayment = async (req, res) => {
  const { amount, method, reference, note, date } = req.body;
  const invoice = await Invoice.findById(req.params.id);
  if (!invoice) return res.status(404).json({ success: false, message: 'Invoice not found' });

  invoice.paymentStatus.payments.push({ amount, method, reference, note, date: date || new Date() });
  invoice.paymentStatus.paidAmount += amount;
  invoice.paymentStatus.pendingAmount = invoice.pricing.grandTotal - invoice.paymentStatus.paidAmount;

  if (invoice.paymentStatus.paidAmount >= invoice.pricing.grandTotal) {
    invoice.status = 'paid';
    invoice.paidAt = new Date();
  } else {
    invoice.status = 'partial';
  }
  await invoice.save();

  // Ledger entry for payment
  await LedgerEntry.create({
    date: date || new Date(), type: 'credit', entityType: 'customer',
    entity: invoice.customer, entityModel: 'Customer', entityName: invoice.customerSnapshot.name,
    description: `Payment received for ${invoice.invoiceNumber}`, amount,
    referenceType: 'payment', referenceNumber: invoice.invoiceNumber, createdBy: req.user.id
  });

  res.json({ success: true, data: invoice, message: 'Payment recorded successfully' });
};

exports.cancelInvoice = async (req, res) => {
  const invoice = await Invoice.findByIdAndUpdate(req.params.id, { isCancelled: true, status: 'cancelled', cancelReason: req.body.reason }, { new: true });
  if (!invoice) return res.status(404).json({ success: false, message: 'Invoice not found' });
  res.json({ success: true, message: 'Invoice cancelled' });
};

exports.generateFromCustomer = async (req, res) => {
  const customer = await Customer.findById(req.params.customerId);
  if (!customer) return res.status(404).json({ success: false, message: 'Customer not found' });
  const company = await Company.findOne();
  const invoiceNumber = await getNextInvoiceNumber();

  const parts = customer.requirements.map(part => ({
    partLabel: part.partLabel, partName: part.partName,
    items: part.items.map(item => ({ description: item.description, quantity: item.quantity, unitPrice: item.unitPrice, totalPrice: item.totalPrice })),
    partTotal: part.partTotal
  }));

  const draft = {
    invoiceNumber, customer: customer._id,
    customerSnapshot: { name: customer.name, companyName: customer.companyName, email: customer.email, phone: customer.phone, address: customer.address, gstin: customer.gstin },
    companySnapshot: company?.toObject() || {},
    parts, pricing: { subtotal: customer.pricing.subtotal, gstType: 'GST', cgstPercent: company?.gstSettings?.cgstPercent || 9, sgstPercent: company?.gstSettings?.sgstPercent || 9 },
    termsAndConditions: company?.termsAndConditions?.invoice || '', aiGenerated: true,
    template: company?.invoiceSettings?.defaultTemplate || 'minimal_white', createdBy: req.user.id
  };

  res.json({ success: true, data: draft, message: 'Invoice draft generated from customer requirements' });
};

exports.convertFromQuotation = async (req, res) => {
  const quotation = await Quotation.findById(req.params.quotationId).populate('customer');
  if (!quotation) return res.status(404).json({ success: false, message: 'Quotation not found' });
  const company = await Company.findOne();
  const invoiceNumber = await getNextInvoiceNumber();

  const invoice = await Invoice.create({
    invoiceNumber, customer: quotation.customer._id,
    customerSnapshot: quotation.customerSnapshot, companySnapshot: company?.toObject() || {},
    parts: quotation.parts, pricing: quotation.pricing,
    notes: quotation.notes, termsAndConditions: quotation.termsAndConditions,
    fromQuotation: quotation._id, template: quotation.template, createdBy: req.user.id
  });

  quotation.status = 'converted';
  quotation.convertedToInvoice = invoice._id;
  quotation.convertedAt = new Date();
  await quotation.save();

  res.status(201).json({ success: true, data: invoice, message: 'Quotation converted to invoice' });
};

exports.getInvoiceStats = async (req, res) => {
  const stats = await Invoice.aggregate([
    { $match: { isCancelled: false } },
    { $group: { _id: '$status', count: { $sum: 1 }, totalAmount: { $sum: '$pricing.grandTotal' } } }
  ]);
  res.json({ success: true, data: stats });
};
