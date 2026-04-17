const aiService = require('../services/aiService');
const Invoice = require('../models/Invoice');
const Customer = require('../models/Customer');
const { Lead, Expense, Supplier, Project } = require('../models/index');

// @desc    ERP Copilot chat
// @route   POST /api/ai/copilot
exports.copilotChat = async (req, res) => {
  const { message, conversationHistory = [] } = req.body;
  const context = { userId: req.user.id, role: req.user.role, timestamp: new Date() };
  const response = await aiService.copilotChat(message, context);
  res.json({ success: true, data: response });
};

// @desc    Get AI pricing suggestions
// @route   POST /api/ai/pricing
exports.getPricingSuggestion = async (req, res) => {
  const { category, requirements } = req.body;
  const historicalData = await Invoice.find({ status: 'paid' }).sort({ createdAt: -1 }).limit(20).select('pricing.grandTotal customerSnapshot.category');
  const suggestion = await aiService.suggestPricing(category, requirements, historicalData);
  res.json({ success: true, data: suggestion });
};

// @desc    Score a lead
// @route   POST /api/ai/score-lead/:id
exports.scoreLead = async (req, res) => {
  const lead = await Lead.findById(req.params.id);
  if (!lead) return res.status(404).json({ success: false, message: 'Lead not found' });
  const score = await aiService.scoreLead(lead);
  lead.aiScore = score;
  await lead.save();
  res.json({ success: true, data: score });
};

// @desc    Analyze project risk
// @route   POST /api/ai/project-risk/:id
exports.analyzeProjectRisk = async (req, res) => {
  const project = await Project.findById(req.params.id).populate('customer', 'name');
  if (!project) return res.status(404).json({ success: false, message: 'Project not found' });
  const analysis = await aiService.analyzeProjectRisk(project);
  project.aiRiskScore = analysis.riskScore;
  project.aiDelayPrediction = analysis.delayProbability?.toString();
  await project.save();
  res.json({ success: true, data: analysis });
};

// @desc    Detect invoice errors
// @route   POST /api/ai/validate-invoice
exports.validateInvoice = async (req, res) => {
  const result = await aiService.detectInvoiceErrors(req.body);
  res.json({ success: true, data: result });
};

// @desc    Auto-categorize expense
// @route   POST /api/ai/categorize-expense
exports.categorizeExpense = async (req, res) => {
  const { description, amount } = req.body;
  const result = await aiService.categorizeExpense(description, amount);
  res.json({ success: true, data: result });
};

// @desc    Generate business insights
// @route   GET /api/ai/insights
exports.getInsights = async (req, res) => {
  const [revenueData, expenseData, leadData] = await Promise.all([
    Invoice.aggregate([
      { $match: { status: 'paid' } },
      { $group: { _id: { month: { $month: '$paidAt' }, year: { $year: '$paidAt' } }, revenue: { $sum: '$pricing.grandTotal' } } },
      { $sort: { '_id.year': -1, '_id.month': -1 } },
      { $limit: 6 }
    ]),
    Expense.aggregate([{ $group: { _id: '$category', total: { $sum: '$amount' } } }]),
    Lead.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }])
  ]);
  const metrics = { revenueData, expenseData, leadData };
  const insights = await aiService.generateBusinessInsights(metrics);
  res.json({ success: true, data: insights });
};

// @desc    Revenue forecast
// @route   GET /api/ai/forecast
exports.getForecast = async (req, res) => {
  const historicalRevenue = await Invoice.aggregate([
    { $match: { status: 'paid' } },
    { $group: { _id: { month: { $month: '$paidAt' }, year: { $year: '$paidAt' } }, revenue: { $sum: '$pricing.grandTotal' } } },
    { $sort: { '_id.year': -1, '_id.month': -1 } },
    { $limit: 12 }
  ]);
  const forecast = await aiService.forecastRevenue(historicalRevenue);
  res.json({ success: true, data: forecast });
};

// @desc    Improve quotation wording
// @route   POST /api/ai/improve-wording
exports.improveWording = async (req, res) => {
  const { text } = req.body;
  const improved = await aiService.improveQuotationWording(text);
  res.json({ success: true, data: { original: text, improved } });
};

// @desc    Score customer health
// @route   GET /api/ai/customer-score/:id
exports.scoreCustomer = async (req, res) => {
  const customer = await Customer.findById(req.params.id);
  if (!customer) return res.status(404).json({ success: false, message: 'Customer not found' });
  const transactions = await Invoice.find({ customer: req.params.id }).select('pricing.grandTotal status paidAt createdAt');
  const score = await aiService.scoreCustomer(customer, transactions);
  customer.aiScore = { ...score, lastAnalyzed: new Date() };
  await customer.save();
  res.json({ success: true, data: score });
};

// @desc    Vendor recommendation
// @route   POST /api/ai/vendor-recommendation
exports.vendorRecommendation = async (req, res) => {
  const { requirement } = req.body;
  const suppliers = await Supplier.find({ isActive: true }).select('name category rating paymentTerms totalPurchases');
  const recommendation = await aiService.recommendVendor(requirement, suppliers);
  res.json({ success: true, data: recommendation });
};
