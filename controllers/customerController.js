const Customer = require('../models/Customer');
const Invoice = require('../models/Invoice');
const { Lead } = require('../models/index');
const aiService = require('../services/aiService');

exports.getCustomers = async (req, res) => {
  const { page = 1, limit = 20, search, status, category, sort = '-createdAt' } = req.query;
  const query = { isCancelled: false };
  if (search) query.$or = [{ name: /search/i }, { email: /search/i }, { companyName: /search/i }, { phone: /search/i }];
  if (search) {
    const regex = new RegExp(search, 'i');
    query.$or = [{ name: regex }, { email: regex }, { companyName: regex }, { phone: regex }, { customerCode: regex }];
  }
  if (status) query.status = status;
  if (category) query.category = category;

  const total = await Customer.countDocuments(query);
  const customers = await Customer.find(query)
    .sort(sort)
    .skip((page - 1) * limit)
    .limit(parseInt(limit))
    .populate('assignedTo', 'name email');

  res.json({ success: true, data: customers, pagination: { total, page: parseInt(page), pages: Math.ceil(total / limit), limit: parseInt(limit) } });
};

exports.getCustomer = async (req, res) => {
  const customer = await Customer.findById(req.params.id).populate('assignedTo', 'name email');
  if (!customer) return res.status(404).json({ success: false, message: 'Customer not found' });
  const invoices = await Invoice.find({ customer: req.params.id }).sort('-createdAt').limit(10);
  res.json({ success: true, data: { customer, invoices } });
};

exports.createCustomer = async (req, res) => {
  const customer = await Customer.create({ ...req.body, createdBy: req.user.id });
  res.status(201).json({ success: true, data: customer, message: 'Customer created successfully' });
};

exports.updateCustomer = async (req, res) => {
  const customer = await Customer.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!customer) return res.status(404).json({ success: false, message: 'Customer not found' });
  res.json({ success: true, data: customer, message: 'Customer updated successfully' });
};

exports.deleteCustomer = async (req, res) => {
  const { reason } = req.body;
  const customer = await Customer.findByIdAndUpdate(req.params.id, { isCancelled: true, cancelledReason: reason, cancelledAt: new Date(), status: 'cancelled' }, { new: true });
  if (!customer) return res.status(404).json({ success: false, message: 'Customer not found' });
  res.json({ success: true, message: 'Customer cancelled successfully' });
};

exports.getCustomerStats = async (req, res) => {
  const stats = await Customer.aggregate([
    { $match: { isCancelled: false } },
    { $group: { _id: '$status', count: { $sum: 1 } } }
  ]);
  const categoryStats = await Customer.aggregate([
    { $match: { isCancelled: false } },
    { $group: { _id: '$category', count: { $sum: 1 } } }
  ]);
  res.json({ success: true, data: { byStatus: stats, byCategory: categoryStats } });
};

exports.convertLeadToCustomer = async (req, res) => {
  const lead = await Lead.findById(req.params.leadId);
  if (!lead) return res.status(404).json({ success: false, message: 'Lead not found' });
  const customer = await Customer.create({
    name: lead.name, email: lead.email, phone: lead.phone,
    companyName: lead.companyName, category: lead.category || 'Other',
    status: 'active', source: lead.source
  });
  lead.status = 'converted';
  lead.convertedCustomer = customer._id;
  lead.convertedAt = new Date();
  await lead.save();
  res.status(201).json({ success: true, data: customer, message: 'Lead converted to customer' });
};

exports.getAiScore = async (req, res) => {
  const customer = await Customer.findById(req.params.id);
  if (!customer) return res.status(404).json({ success: false, message: 'Customer not found' });
  const transactions = await Invoice.find({ customer: req.params.id }).select('pricing.grandTotal status');
  const score = await aiService.scoreCustomer(customer, transactions);
  customer.aiScore = { ...score, lastAnalyzed: new Date() };
  await customer.save();
  res.json({ success: true, data: score });
};
