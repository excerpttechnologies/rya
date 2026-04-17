const express = require('express');
const { protect, checkPermission } = require('../middleware/auth');
const Invoice = require('../models/Invoice');
const Customer = require('../models/Customer');

// ---- USERS ----
const usersRouter = express.Router();
const User = require('../models/User');
usersRouter.use(protect);
usersRouter.get('/', checkPermission('users'), async (req, res) => {
  const users = await User.find().select('-password').sort('-createdAt');
  res.json({ success: true, data: users });
});
usersRouter.post('/', checkPermission('users'), async (req, res) => {
  const user = await User.create(req.body);
  res.status(201).json({ success: true, data: user });
});
usersRouter.put('/:id', checkPermission('users'), async (req, res) => {
  const { password, ...updateData } = req.body;
  const user = await User.findByIdAndUpdate(req.params.id, updateData, { new: true });
  res.json({ success: true, data: user });
});
usersRouter.delete('/:id', checkPermission('users'), async (req, res) => {
  await User.findByIdAndUpdate(req.params.id, { isActive: false });
  res.json({ success: true, message: 'User deactivated' });
});
usersRouter.put('/:id/permissions', checkPermission('users'), async (req, res) => {
  const user = await User.findByIdAndUpdate(req.params.id, { permissions: req.body.permissions }, { new: true });
  res.json({ success: true, data: user });
});
module.exports.usersRouter = usersRouter;

// ---- COMPANY ----
const companyRouter = express.Router();
const Company = require('../models/Company');
companyRouter.use(protect);
companyRouter.get('/', async (req, res) => {
  let company = await Company.findOne();
  if (!company) company = await Company.create({ name: 'Excerpt Technologies Pvt Ltd' });
  res.json({ success: true, data: company });
});
companyRouter.put('/', checkPermission('company'), async (req, res) => {
  let company = await Company.findOne();
  if (!company) company = new Company();
  Object.assign(company, req.body);
  await company.save();
  res.json({ success: true, data: company, message: 'Company settings updated' });
});
module.exports.companyRouter = companyRouter;

// ---- CUSTOMERS ----
const customerRouter = express.Router();
const { getCustomers, getCustomer, createCustomer, updateCustomer, deleteCustomer, getCustomerStats, convertLeadToCustomer, getAiScore, generateFromCustomer } = require('../controllers/customerController');
customerRouter.use(protect);
customerRouter.get('/', checkPermission('customers'), getCustomers);
customerRouter.post('/', checkPermission('customers'), createCustomer);
customerRouter.get('/stats', checkPermission('customers'), getCustomerStats);
customerRouter.get('/:id', checkPermission('customers'), getCustomer);
customerRouter.put('/:id', checkPermission('customers'), updateCustomer);
customerRouter.delete('/:id', checkPermission('customers'), deleteCustomer);
customerRouter.get('/:id/ai-score', checkPermission('customers'), getAiScore);
customerRouter.post('/convert-lead/:leadId', checkPermission('customers'), convertLeadToCustomer);
module.exports.customerRouter = customerRouter;

// ---- INVOICES ----
const invoiceRouter = express.Router();
const { getInvoices, getInvoice, createInvoice, updateInvoice, recordPayment, cancelInvoice, generateFromCustomer: genInvoice, convertFromQuotation, getInvoiceStats } = require('../controllers/invoiceController');
invoiceRouter.use(protect);
invoiceRouter.get('/', checkPermission('invoices'), getInvoices);
invoiceRouter.post('/', checkPermission('invoices'), createInvoice);
invoiceRouter.get('/stats', checkPermission('invoices'), getInvoiceStats);
invoiceRouter.get('/:id', checkPermission('invoices'), getInvoice);
invoiceRouter.put('/:id', checkPermission('invoices'), updateInvoice);
invoiceRouter.post('/:id/payment', checkPermission('invoices'), recordPayment);
invoiceRouter.put('/:id/cancel', checkPermission('invoices'), cancelInvoice);
invoiceRouter.get('/generate-from-customer/:customerId', checkPermission('invoices'), genInvoice);
invoiceRouter.post('/convert-from-quotation/:quotationId', checkPermission('invoices'), convertFromQuotation);
module.exports.invoiceRouter = invoiceRouter;

// ---- QUOTATIONS ----
const quotationRouter = express.Router();
const { Quotation } = require('../models/index');
quotationRouter.use(protect);
quotationRouter.get('/', checkPermission('quotations'), async (req, res) => {
  const { page = 1, limit = 20, status, search } = req.query;
  const query = {};
  if (status) query.status = status;
  if (search) { const r = new RegExp(search, 'i'); query.$or = [{ quotationNumber: r }, { 'customerSnapshot.name': r }]; }
  const total = await Quotation.countDocuments(query);
  const data = await Quotation.find(query).sort('-createdAt').skip((page-1)*limit).limit(parseInt(limit)).populate('customer', 'name companyName');
  res.json({ success: true, data, pagination: { total, page: parseInt(page), pages: Math.ceil(total/limit) } });
});
quotationRouter.post('/', checkPermission('quotations'), async (req, res) => {
  const Company = require('../models/Company');
  const Customer = require('../models/Customer');
  const company = await Company.findOne();
  const settings = company?.quotationSettings || { prefix: 'QT', nextNumber: 1001 };
  const year = new Date().getFullYear();
  const quotationNumber = `${settings.prefix}-${year}-${settings.nextNumber}`;
  if (company) { company.quotationSettings.nextNumber += 1; await company.save(); }
  const customer = await Customer.findById(req.body.customer);
  const validUntil = new Date(); validUntil.setDate(validUntil.getDate() + (settings.validityDays || 15));
  const q = await Quotation.create({
    ...req.body, quotationNumber, validUntil: req.body.validUntil || validUntil,
    customerSnapshot: customer ? { name: customer.name, companyName: customer.companyName, email: customer.email, phone: customer.phone, address: customer.address, gstin: customer.gstin } : {},
    createdBy: req.user.id
  });
  res.status(201).json({ success: true, data: q });
});
quotationRouter.get('/:id', checkPermission('quotations'), async (req, res) => {
  const q = await Quotation.findById(req.params.id).populate('customer');
  const company = await require('../models/Company').findOne();
  if (!q) return res.status(404).json({ success: false, message: 'Quotation not found' });
  res.json({ success: true, data: { quotation: q, company } });
});
quotationRouter.put('/:id', checkPermission('quotations'), async (req, res) => {
  const q = await Quotation.findByIdAndUpdate(req.params.id, req.body, { new: true });
  res.json({ success: true, data: q });
});
module.exports.quotationRouter = quotationRouter;

// ---- PAYMENTS ----
const paymentRouter = express.Router();
paymentRouter.use(protect);
paymentRouter.get('/', checkPermission('payments'), async (req, res) => {
  const { status, customer, page = 1, limit = 20 } = req.query;
  const query = { isCancelled: false };
  if (status) query.status = status;
  if (customer) query.customer = customer;
  const invoices = await Invoice.find(query).sort('-createdAt').skip((page-1)*limit).limit(parseInt(limit)).populate('customer', 'name companyName phone email');
  const total = await Invoice.countDocuments(query);
  const summary = await Invoice.aggregate([
    { $match: { isCancelled: false } },
    { $group: { _id: null, totalAmount: { $sum: '$pricing.grandTotal' }, totalPaid: { $sum: '$paymentStatus.paidAmount' }, totalPending: { $sum: '$paymentStatus.pendingAmount' } } }
  ]);
  res.json({ success: true, data: invoices, summary: summary[0] || {}, pagination: { total, pages: Math.ceil(total/limit) } });
});
module.exports.paymentRouter = paymentRouter;

// ---- SUPPLIERS ----
const supplierRouter = express.Router();
const { Supplier } = require('../models/index');
supplierRouter.use(protect);
supplierRouter.get('/', checkPermission('suppliers'), async (req, res) => {
  const { search, category, page = 1, limit = 20 } = req.query;
  const query = { isCancelled: false };
  if (search) { const r = new RegExp(search, 'i'); query.$or = [{ name: r }, { companyName: r }, { email: r }]; }
  if (category) query.category = category;
  const total = await Supplier.countDocuments(query);
  const data = await Supplier.find(query).sort('-createdAt').skip((page-1)*limit).limit(parseInt(limit));
  res.json({ success: true, data, pagination: { total, pages: Math.ceil(total/limit) } });
});
supplierRouter.post('/', checkPermission('suppliers'), async (req, res) => {
  const supplier = await Supplier.create(req.body);
  res.status(201).json({ success: true, data: supplier });
});
supplierRouter.get('/:id', checkPermission('suppliers'), async (req, res) => {
  const supplier = await Supplier.findById(req.params.id);
  if (!supplier) return res.status(404).json({ success: false, message: 'Not found' });
  res.json({ success: true, data: supplier });
});
supplierRouter.put('/:id', checkPermission('suppliers'), async (req, res) => {
  const supplier = await Supplier.findByIdAndUpdate(req.params.id, req.body, { new: true });
  res.json({ success: true, data: supplier });
});
supplierRouter.delete('/:id', checkPermission('suppliers'), async (req, res) => {
  await Supplier.findByIdAndUpdate(req.params.id, { isCancelled: true, cancelReason: req.body.reason });
  res.json({ success: true, message: 'Supplier cancelled' });
});
module.exports.supplierRouter = supplierRouter;

// ---- PURCHASES ----
const purchaseRouter = express.Router();
const { Purchase } = require('../models/index');
purchaseRouter.use(protect);
purchaseRouter.get('/', checkPermission('purchases'), async (req, res) => {
  const { page = 1, limit = 20, supplier, paymentStatus } = req.query;
  const query = { isCancelled: false };
  if (supplier) query.supplier = supplier;
  if (paymentStatus) query.paymentStatus = paymentStatus;
  const total = await Purchase.countDocuments(query);
  const data = await Purchase.find(query).sort('-createdAt').skip((page-1)*limit).limit(parseInt(limit)).populate('supplier', 'name companyName');
  res.json({ success: true, data, pagination: { total, pages: Math.ceil(total/limit) } });
});
purchaseRouter.post('/', checkPermission('purchases'), async (req, res) => {
  const purchase = await Purchase.create({ ...req.body, createdBy: req.user.id });
  const { Supplier } = require('../models/index');
  await Supplier.findByIdAndUpdate(req.body.supplier, { $inc: { totalPurchases: purchase.pricing?.grandTotal || 0 } });
  res.status(201).json({ success: true, data: purchase });
});
purchaseRouter.get('/:id', checkPermission('purchases'), async (req, res) => {
  const data = await Purchase.findById(req.params.id).populate('supplier');
  res.json({ success: true, data });
});
purchaseRouter.put('/:id', checkPermission('purchases'), async (req, res) => {
  const data = await Purchase.findByIdAndUpdate(req.params.id, req.body, { new: true });
  res.json({ success: true, data });
});
module.exports.purchaseRouter = purchaseRouter;

// ---- EXPENSES ----
const expenseRouter = express.Router();
const { Expense } = require('../models/index');
expenseRouter.use(protect);
expenseRouter.get('/', checkPermission('expenses'), async (req, res) => {
  const { page = 1, limit = 20, category, month, year } = req.query;
  const query = {};
  if (category) query.category = category;
  if (month && year) { const start = new Date(year, month-1, 1); const end = new Date(year, month, 0); query.date = { $gte: start, $lte: end }; }
  const total = await Expense.countDocuments(query);
  const data = await Expense.find(query).sort('-date').skip((page-1)*limit).limit(parseInt(limit));
  const summary = await Expense.aggregate([{ $match: query }, { $group: { _id: null, total: { $sum: '$amount' } } }]);
  res.json({ success: true, data, summary: summary[0] || { total: 0 }, pagination: { total, pages: Math.ceil(total/limit) } });
});
expenseRouter.post('/', checkPermission('expenses'), async (req, res) => {
  const expense = await Expense.create({ ...req.body, createdBy: req.user.id });
  res.status(201).json({ success: true, data: expense });
});
expenseRouter.put('/:id', checkPermission('expenses'), async (req, res) => {
  const data = await Expense.findByIdAndUpdate(req.params.id, req.body, { new: true });
  res.json({ success: true, data });
});
expenseRouter.delete('/:id', checkPermission('expenses'), async (req, res) => {
  await Expense.findByIdAndDelete(req.params.id);
  res.json({ success: true, message: 'Expense deleted' });
});
expenseRouter.get('/breakdown', checkPermission('expenses'), async (req, res) => {
  const { month, year } = req.query;
  const query = {};
  if (month && year) { const start = new Date(year, month-1, 1); const end = new Date(year, month, 0); query.date = { $gte: start, $lte: end }; }
  const data = await Expense.aggregate([{ $match: query }, { $group: { _id: '$category', total: { $sum: '$amount' }, count: { $sum: 1 } } }, { $sort: { total: -1 } }]);
  res.json({ success: true, data });
});
module.exports.expenseRouter = expenseRouter;

// ---- EMPLOYEES ----
const employeeRouter = express.Router();
const { Employee } = require('../models/index');
employeeRouter.use(protect);
employeeRouter.get('/', checkPermission('employees'), async (req, res) => {
  const { department, page = 1, limit = 20, search } = req.query;
  const query = { isActive: true };
  if (department) query.department = department;
  if (search) { const r = new RegExp(search, 'i'); query.$or = [{ name: r }, { email: r }, { employeeCode: r }]; }
  const total = await Employee.countDocuments(query);
  const data = await Employee.find(query).sort('name').skip((page-1)*limit).limit(parseInt(limit));
  res.json({ success: true, data, pagination: { total, pages: Math.ceil(total/limit) } });
});
employeeRouter.post('/', checkPermission('employees'), async (req, res) => {
  const employee = await Employee.create(req.body);
  res.status(201).json({ success: true, data: employee });
});
employeeRouter.get('/:id', checkPermission('employees'), async (req, res) => {
  const data = await Employee.findById(req.params.id);
  if (!data) return res.status(404).json({ success: false, message: 'Employee not found' });
  res.json({ success: true, data });
});
employeeRouter.put('/:id', checkPermission('employees'), async (req, res) => {
  const data = await Employee.findByIdAndUpdate(req.params.id, req.body, { new: true });
  res.json({ success: true, data });
});
module.exports.employeeRouter = employeeRouter;

// ---- SALARIES ----
const salaryRouter = express.Router();
const { Salary } = require('../models/index');
salaryRouter.use(protect);
salaryRouter.get('/', checkPermission('salaries'), async (req, res) => {
  const { month, year, employee, page = 1, limit = 20 } = req.query;
  const query = {};
  if (month) query.month = parseInt(month);
  if (year) query.year = parseInt(year);
  if (employee) query.employee = employee;
  const total = await Salary.countDocuments(query);
  const data = await Salary.find(query).sort('-year -month').skip((page-1)*limit).limit(parseInt(limit)).populate('employee', 'name employeeCode department designation');
  res.json({ success: true, data, pagination: { total, pages: Math.ceil(total/limit) } });
});
salaryRouter.post('/', checkPermission('salaries'), async (req, res) => {
  const existing = await Salary.findOne({ employee: req.body.employee, month: req.body.month, year: req.body.year });
  if (existing) return res.status(400).json({ success: false, message: 'Salary already processed for this month' });
  const salary = await Salary.create({ ...req.body, createdBy: req.user.id });
  res.status(201).json({ success: true, data: salary });
});
salaryRouter.put('/:id', checkPermission('salaries'), async (req, res) => {
  const data = await Salary.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  res.json({ success: true, data });
});
salaryRouter.get('/summary', checkPermission('salaries'), async (req, res) => {
  const { month, year } = req.query;
  const query = {};
  if (month) query.month = parseInt(month);
  if (year) query.year = parseInt(year);
  const data = await Salary.aggregate([{ $match: query }, { $group: { _id: null, totalGross: { $sum: '$grossSalary' }, totalNet: { $sum: '$netSalary' }, totalDeductions: { $sum: { $add: ['$pf', '$esi', '$tds', '$leaveDeduction'] } }, count: { $sum: 1 } } }]);
  res.json({ success: true, data: data[0] || {} });
});
module.exports.salaryRouter = salaryRouter;

// ---- PRODUCTS ----
const productRouter = express.Router();
const { Product } = require('../models/index');
productRouter.use(protect);
productRouter.get('/', checkPermission('products'), async (req, res) => {
  const data = await Product.find().sort('-createdAt');
  res.json({ success: true, data });
});
productRouter.post('/', checkPermission('products'), async (req, res) => {
  const product = await Product.create(req.body);
  res.status(201).json({ success: true, data: product });
});
productRouter.get('/:id', checkPermission('products'), async (req, res) => {
  const data = await Product.findById(req.params.id).populate('clients', 'name companyName');
  res.json({ success: true, data });
});
productRouter.put('/:id', checkPermission('products'), async (req, res) => {
  const data = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true });
  res.json({ success: true, data });
});
module.exports.productRouter = productRouter;

// ---- LEDGER ----
const ledgerRouter = express.Router();
const { LedgerEntry } = require('../models/index');
ledgerRouter.use(protect);
ledgerRouter.get('/', checkPermission('ledger'), async (req, res) => {
  const { entityType, entity, type, startDate, endDate, page = 1, limit = 30 } = req.query;
  const query = {};
  if (entityType) query.entityType = entityType;
  if (entity) query.entity = entity;
  if (type) query.type = type;
  if (startDate || endDate) { query.date = {}; if (startDate) query.date.$gte = new Date(startDate); if (endDate) query.date.$lte = new Date(endDate); }
  const total = await LedgerEntry.countDocuments(query);
  const data = await LedgerEntry.find(query).sort('-date').skip((page-1)*limit).limit(parseInt(limit));
  const summary = await LedgerEntry.aggregate([
    { $match: query },
    { $group: { _id: '$type', total: { $sum: '$amount' } } }
  ]);
  res.json({ success: true, data, summary, pagination: { total, pages: Math.ceil(total/limit) } });
});
ledgerRouter.post('/', checkPermission('ledger'), async (req, res) => {
  const entry = await LedgerEntry.create({ ...req.body, createdBy: req.user.id });
  res.status(201).json({ success: true, data: entry });
});
module.exports.ledgerRouter = ledgerRouter;

// ---- REPORTS ----
const reportRouter = express.Router();
reportRouter.use(protect, checkPermission('reports'));
reportRouter.get('/profit-loss', async (req, res) => {
  const { year, month } = req.query;
  const y = parseInt(year) || new Date().getFullYear();
  const startDate = month ? new Date(y, parseInt(month)-1, 1) : new Date(y, 0, 1);
  const endDate = month ? new Date(y, parseInt(month), 0) : new Date(y, 11, 31);
  const [revenue, expenses] = await Promise.all([
    Invoice.aggregate([{ $match: { status: 'paid', paidAt: { $gte: startDate, $lte: endDate } } }, { $group: { _id: null, total: { $sum: '$pricing.grandTotal' } } }]),
    require('../models/index').Expense.aggregate([{ $match: { date: { $gte: startDate, $lte: endDate } } }, { $group: { _id: null, total: { $sum: '$amount' } } }])
  ]);
  const totalRevenue = revenue[0]?.total || 0;
  const totalExpenses = expenses[0]?.total || 0;
  res.json({ success: true, data: { revenue: totalRevenue, expenses: totalExpenses, profit: totalRevenue - totalExpenses, profitMargin: totalRevenue > 0 ? ((totalRevenue - totalExpenses) / totalRevenue * 100).toFixed(2) : 0, period: { startDate, endDate } } });
});
reportRouter.get('/revenue', async (req, res) => {
  const { year } = req.query;
  const y = parseInt(year) || new Date().getFullYear();
  const data = await Invoice.aggregate([
    { $match: { status: 'paid', paidAt: { $gte: new Date(y, 0, 1), $lte: new Date(y, 11, 31) } } },
    { $group: { _id: { month: { $month: '$paidAt' } }, revenue: { $sum: '$pricing.grandTotal' }, count: { $sum: 1 } } },
    { $sort: { '_id.month': 1 } }
  ]);
  res.json({ success: true, data });
});
reportRouter.get('/expenses', async (req, res) => {
  const { year, month } = req.query;
  const y = parseInt(year) || new Date().getFullYear();
  const query = { date: { $gte: new Date(y, 0, 1), $lte: new Date(y, 11, 31) } };
  if (month) { query.date = { $gte: new Date(y, parseInt(month)-1, 1), $lte: new Date(y, parseInt(month), 0) }; }
  const data = await require('../models/index').Expense.aggregate([
    { $match: query },
    { $group: { _id: '$category', total: { $sum: '$amount' }, count: { $sum: 1 } } },
    { $sort: { total: -1 } }
  ]);
  res.json({ success: true, data });
});
module.exports.reportRouter = reportRouter;

// ---- PROJECTS ----
const projectRouter = express.Router();
const { Project } = require('../models/index');
projectRouter.use(protect);
projectRouter.get('/', checkPermission('projects'), async (req, res) => {
  const { status, customer, page = 1, limit = 20 } = req.query;
  const query = {};
  if (status) query.status = status;
  if (customer) query.customer = customer;
  const total = await Project.countDocuments(query);
  const data = await Project.find(query).sort('-createdAt').skip((page-1)*limit).limit(parseInt(limit)).populate('customer', 'name companyName').populate('manager', 'name');
  res.json({ success: true, data, pagination: { total, pages: Math.ceil(total/limit) } });
});
projectRouter.post('/', checkPermission('projects'), async (req, res) => {
  const project = await Project.create({ ...req.body, manager: req.user.id });
  res.status(201).json({ success: true, data: project });
});
projectRouter.get('/:id', checkPermission('projects'), async (req, res) => {
  const data = await Project.findById(req.params.id).populate('customer').populate('team').populate('manager', 'name email');
  if (!data) return res.status(404).json({ success: false, message: 'Project not found' });
  res.json({ success: true, data });
});
projectRouter.put('/:id', checkPermission('projects'), async (req, res) => {
  const data = await Project.findByIdAndUpdate(req.params.id, req.body, { new: true });
  res.json({ success: true, data });
});
projectRouter.post('/:id/update', checkPermission('projects'), async (req, res) => {
  const project = await Project.findById(req.params.id);
  if (!project) return res.status(404).json({ success: false, message: 'Project not found' });
  project.updates.push({ date: new Date(), content: req.body.content, by: req.user.id, type: req.body.type || 'update' });
  await project.save();
  res.json({ success: true, data: project });
});
module.exports.projectRouter = projectRouter;

// ---- SCRUM ----
const scrumRouter = express.Router();
const { ScrumEntry } = require('../models/index');
scrumRouter.use(protect);
scrumRouter.get('/', checkPermission('scrum'), async (req, res) => {
  const { date, type, project, page = 1, limit = 20 } = req.query;
  const query = {};
  if (type) query.type = type;
  if (project) query.project = project;
  if (date) { const d = new Date(date); const next = new Date(d); next.setDate(next.getDate() + 1); query.date = { $gte: d, $lt: next }; }
  const total = await ScrumEntry.countDocuments(query);
  const data = await ScrumEntry.find(query).sort('-date').skip((page-1)*limit).limit(parseInt(limit)).populate('scrumMaster', 'name').populate('entries.employee');
  res.json({ success: true, data, pagination: { total, pages: Math.ceil(total/limit) } });
});
scrumRouter.post('/', checkPermission('scrum'), async (req, res) => {
  const entry = await ScrumEntry.create({ ...req.body, scrumMaster: req.user.id });
  res.status(201).json({ success: true, data: entry });
});
scrumRouter.get('/:id', checkPermission('scrum'), async (req, res) => {
  const data = await ScrumEntry.findById(req.params.id).populate('scrumMaster', 'name').populate('entries.employee').populate('project', 'name');
  res.json({ success: true, data });
});
scrumRouter.put('/:id', checkPermission('scrum'), async (req, res) => {
  const data = await ScrumEntry.findByIdAndUpdate(req.params.id, req.body, { new: true });
  res.json({ success: true, data });
});
module.exports.scrumRouter = scrumRouter;

// ---- LEADS ----
const leadRouter = express.Router();
const { Lead } = require('../models/index');
leadRouter.use(protect);
leadRouter.get('/', checkPermission('leads'), async (req, res) => {
  const { status, priority, assignedTo, search, page = 1, limit = 20 } = req.query;
  const query = {};
  if (status) query.status = status;
  if (priority) query.priority = priority;
  if (assignedTo) query.assignedTo = assignedTo;
  if (search) { const r = new RegExp(search, 'i'); query.$or = [{ name: r }, { email: r }, { companyName: r }, { phone: r }]; }
  const total = await Lead.countDocuments(query);
  const data = await Lead.find(query).sort('-createdAt').skip((page-1)*limit).limit(parseInt(limit)).populate('assignedTo', 'name').populate('convertedCustomer', 'name');
  const funnel = await Lead.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]);
  res.json({ success: true, data, funnel, pagination: { total, pages: Math.ceil(total/limit) } });
});
leadRouter.post('/', checkPermission('leads'), async (req, res) => {
  const lead = await Lead.create({ ...req.body, createdBy: req.user.id });
  res.status(201).json({ success: true, data: lead });
});
leadRouter.get('/:id', checkPermission('leads'), async (req, res) => {
  const data = await Lead.findById(req.params.id).populate('assignedTo', 'name email').populate('convertedCustomer');
  res.json({ success: true, data });
});
leadRouter.put('/:id', checkPermission('leads'), async (req, res) => {
  const data = await Lead.findByIdAndUpdate(req.params.id, req.body, { new: true });
  res.json({ success: true, data });
});
leadRouter.post('/:id/follow-up', checkPermission('leads'), async (req, res) => {
  const lead = await Lead.findById(req.params.id);
  if (!lead) return res.status(404).json({ success: false, message: 'Lead not found' });
  lead.followUps.push({ date: new Date(), note: req.body.note, by: req.user.id, outcome: req.body.outcome });
  if (req.body.nextFollowUpDate) lead.nextFollowUpDate = req.body.nextFollowUpDate;
  if (req.body.status) lead.status = req.body.status;
  await lead.save();
  res.json({ success: true, data: lead });
});
module.exports.leadRouter = leadRouter;

// ---- DASHBOARD ----
const dashboardRouter = express.Router();
const { getDashboard, getMiniStats } = require('../controllers/dashboardController');
dashboardRouter.use(protect);
dashboardRouter.get('/', getDashboard);
dashboardRouter.get('/mini/:module', getMiniStats);
module.exports.dashboardRouter = dashboardRouter;

// ---- AI ----
const aiRouter = express.Router();
const { copilotChat, getPricingSuggestion, scoreLead, analyzeProjectRisk, validateInvoice, categorizeExpense, getInsights, getForecast, improveWording, scoreCustomer, vendorRecommendation } = require('../controllers/aiController');
aiRouter.use(protect);
aiRouter.post('/copilot', copilotChat);
aiRouter.post('/pricing', getPricingSuggestion);
aiRouter.get('/score-lead/:id', scoreLead);
aiRouter.get('/project-risk/:id', analyzeProjectRisk);
aiRouter.post('/validate-invoice', validateInvoice);
aiRouter.post('/categorize-expense', categorizeExpense);
aiRouter.get('/insights', getInsights);
aiRouter.get('/forecast', getForecast);
aiRouter.post('/improve-wording', improveWording);
aiRouter.get('/customer-score/:id', scoreCustomer);
aiRouter.post('/vendor-recommendation', vendorRecommendation);
module.exports.aiRouter = aiRouter;

// ---- CANCELLED ----
const cancelledRouter = express.Router();
cancelledRouter.use(protect);
cancelledRouter.get('/', async (req, res) => {
  const { type, page = 1, limit = 20 } = req.query;
  const results = {};
  if (!type || type === 'customers') results.customers = await Customer.find({ isCancelled: true }).sort('-cancelledAt').limit(parseInt(limit));
  if (!type || type === 'suppliers') results.suppliers = await require('../models/index').Supplier.find({ isCancelled: true }).sort('-updatedAt').limit(parseInt(limit));
  if (!type || type === 'invoices') results.invoices = await Invoice.find({ isCancelled: true }).sort('-updatedAt').limit(parseInt(limit));
  if (!type || type === 'purchases') results.purchases = await require('../models/index').Purchase.find({ isCancelled: true }).sort('-updatedAt').limit(parseInt(limit));
  res.json({ success: true, data: results });
});
module.exports.cancelledRouter = cancelledRouter;

// ---- AUDITOR REPORT (Additional endpoint) ----
const auditorRouter = express.Router();
auditorRouter.use(protect, checkPermission('reports'));
auditorRouter.get('/summary', async (req, res) => {
  const { year, month, startDate, endDate } = req.query;
  const { Expense, Employee, Salary } = require('../models/index');

  let dateFilter = {};
  if (startDate && endDate) {
    dateFilter = { $gte: new Date(startDate), $lte: new Date(endDate) };
  } else if (year && month) {
    const y = parseInt(year), m = parseInt(month);
    dateFilter = { $gte: new Date(y, m - 1, 1), $lte: new Date(y, m, 0) };
  } else if (year) {
    dateFilter = { $gte: new Date(parseInt(year), 0, 1), $lte: new Date(parseInt(year), 11, 31) };
  }

  const [revenue, expenses, invoiceStats, purchaseStats, salaryStats] = await Promise.all([
    Invoice.aggregate([
      { $match: { status: 'paid', ...(dateFilter.$gte ? { paidAt: dateFilter } : {}) } },
      { $group: { _id: null, total: { $sum: '$pricing.grandTotal' }, gstCollected: { $sum: '$pricing.totalGst' }, count: { $sum: 1 } } }
    ]),
    Expense.aggregate([
      { $match: dateFilter.$gte ? { date: dateFilter } : {} },
      { $group: { _id: '$category', total: { $sum: '$amount' }, count: { $sum: 1 } } },
      { $sort: { total: -1 } }
    ]),
    Invoice.aggregate([{ $group: { _id: '$status', count: { $sum: 1 }, totalAmount: { $sum: '$pricing.grandTotal' } } }]),
    require('../models/index').Purchase.aggregate([
      { $match: { isCancelled: false } },
      { $group: { _id: null, total: { $sum: '$pricing.grandTotal' }, gstPaid: { $sum: '$pricing.gstAmount' }, count: { $sum: 1 } } }
    ]),
    Salary.aggregate([
      { $match: year ? { year: parseInt(year) } : {} },
      { $group: { _id: null, totalGross: { $sum: '$grossSalary' }, totalNet: { $sum: '$netSalary' }, count: { $sum: 1 } } }
    ])
  ]);

  const totalRevenue = revenue[0]?.total || 0;
  const totalExpenses = expenses.reduce((s, e) => s + e.total, 0);

  res.json({
    success: true,
    data: {
      revenue: { total: totalRevenue, gstCollected: revenue[0]?.gstCollected || 0, invoiceCount: revenue[0]?.count || 0 },
      expenses: { total: totalExpenses, breakdown: expenses },
      invoices: invoiceStats,
      purchases: { total: purchaseStats[0]?.total || 0, gstPaid: purchaseStats[0]?.gstPaid || 0, count: purchaseStats[0]?.count || 0 },
      salaries: { totalGross: salaryStats[0]?.totalGross || 0, totalNet: salaryStats[0]?.totalNet || 0 },
      profit: totalRevenue - totalExpenses,
      profitMargin: totalRevenue > 0 ? ((totalRevenue - totalExpenses) / totalRevenue * 100).toFixed(2) : 0
    }
  });
});
module.exports.auditorRouter = auditorRouter;

// Add file upload handler for purchases
purchaseRouter.post('/upload/:id', protect, checkPermission('purchases'), async (req, res) => {
  const path = require('path');
  const purchase = await Purchase.findById(req.params.id);
  if (!purchase) return res.status(404).json({ success: false, message: 'Purchase not found' });
  if (req.files && req.files.invoice) {
    const file = req.files.invoice;
    const fileName = `purchase_${purchase.purchaseNumber}_${Date.now()}${path.extname(file.name)}`;
    const uploadPath = path.join(__dirname, '../../uploads/purchases/', fileName);
    await file.mv(uploadPath);
    purchase.documents.push({ name: file.name, url: `purchases/${fileName}`, uploadedAt: new Date() });
    await purchase.save();
    return res.json({ success: true, data: purchase, message: 'Document uploaded' });
  }
  res.status(400).json({ success: false, message: 'No file uploaded' });
});

// Add file upload for expenses
expenseRouter.post('/upload/:id', protect, checkPermission('expenses'), async (req, res) => {
  const path = require('path');
  const expense = await Expense.findById(req.params.id);
  if (!expense) return res.status(404).json({ success: false, message: 'Expense not found' });
  if (req.files && req.files.receipt) {
    const file = req.files.receipt;
    const fileName = `expense_${Date.now()}${path.extname(file.name)}`;
    const uploadPath = path.join(__dirname, '../../uploads/expenses/', fileName);
    await file.mv(uploadPath);
    expense.receipt = `expenses/${fileName}`;
    await expense.save();
    return res.json({ success: true, data: expense, message: 'Receipt uploaded' });
  }
  res.status(400).json({ success: false, message: 'No file uploaded' });
});
