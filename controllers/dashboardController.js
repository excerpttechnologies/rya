const Invoice = require('../models/Invoice');
const Customer = require('../models/Customer');
const { Lead, Expense, Employee, Project, Salary } = require('../models/index');
const aiService = require('../services/aiService');

// @desc    Get dashboard metrics
// @route   GET /api/dashboard
exports.getDashboard = async (req, res) => {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

  // Parallel data fetching
  const [
    totalRevenue, monthRevenue, lastMonthRevenue,
    pendingPayments, totalExpenses, monthExpenses,
    totalCustomers, activeCustomers, totalLeads,
    convertedLeads, activeProjects, overdueInvoices,
    totalEmployees, recentInvoices, topCustomers
  ] = await Promise.all([
    Invoice.aggregate([{ $match: { status: 'paid' } }, { $group: { _id: null, total: { $sum: '$pricing.grandTotal' } } }]),
    Invoice.aggregate([{ $match: { status: 'paid', paidAt: { $gte: startOfMonth } } }, { $group: { _id: null, total: { $sum: '$pricing.grandTotal' } } }]),
    Invoice.aggregate([{ $match: { status: 'paid', paidAt: { $gte: lastMonthStart, $lte: lastMonthEnd } } }, { $group: { _id: null, total: { $sum: '$pricing.grandTotal' } } }]),
    Invoice.aggregate([{ $match: { status: { $in: ['sent', 'partial', 'overdue'] } } }, { $group: { _id: null, total: { $sum: '$paymentStatus.pendingAmount' } } }]),
    Expense.aggregate([{ $match: { createdAt: { $gte: startOfYear } } }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
    Expense.aggregate([{ $match: { createdAt: { $gte: startOfMonth } } }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
    Customer.countDocuments({ isCancelled: false }),
    Customer.countDocuments({ status: 'active', isCancelled: false }),
    Lead.countDocuments(),
    Lead.countDocuments({ status: 'converted' }),
    Project.countDocuments({ status: 'in_progress' }),
    Invoice.countDocuments({ status: 'overdue' }),
    Employee.countDocuments({ isActive: true }),
    Invoice.find().sort({ createdAt: -1 }).limit(5).populate('customer', 'name companyName'),
    Invoice.aggregate([
      { $match: { status: 'paid' } },
      { $group: { _id: '$customer', totalRevenue: { $sum: '$pricing.grandTotal' } } },
      { $sort: { totalRevenue: -1 } },
      { $limit: 5 },
      { $lookup: { from: 'customers', localField: '_id', foreignField: '_id', as: 'customer' } },
      { $unwind: '$customer' }
    ])
  ]);

  // Monthly revenue chart (last 12 months)
  const monthlyRevenue = await Invoice.aggregate([
    { $match: { status: 'paid', paidAt: { $gte: new Date(now.getFullYear() - 1, now.getMonth(), 1) } } },
    { $group: { _id: { year: { $year: '$paidAt' }, month: { $month: '$paidAt' } }, revenue: { $sum: '$pricing.grandTotal' }, count: { $sum: 1 } } },
    { $sort: { '_id.year': 1, '_id.month': 1 } }
  ]);

  // Monthly expenses chart
  const monthlyExpenses = await Expense.aggregate([
    { $match: { createdAt: { $gte: new Date(now.getFullYear() - 1, now.getMonth(), 1) } } },
    { $group: { _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } }, expenses: { $sum: '$amount' } } },
    { $sort: { '_id.year': 1, '_id.month': 1 } }
  ]);

  // Lead funnel
  const leadFunnel = await Lead.aggregate([
    { $group: { _id: '$status', count: { $sum: 1 } } }
  ]);

  // Expense breakdown
  const expenseBreakdown = await Expense.aggregate([
    { $match: { createdAt: { $gte: startOfMonth } } },
    { $group: { _id: '$category', total: { $sum: '$amount' } } },
    { $sort: { total: -1 } }
  ]);

  const revenueVal = totalRevenue[0]?.total || 0;
  const monthRevenueVal = monthRevenue[0]?.total || 0;
  const lastMonthRevenueVal = lastMonthRevenue[0]?.total || 0;
  const revenueGrowth = lastMonthRevenueVal > 0 
    ? (((monthRevenueVal - lastMonthRevenueVal) / lastMonthRevenueVal) * 100).toFixed(1)
    : 0;

  const metrics = {
    revenue: { total: revenueVal, thisMonth: monthRevenueVal, lastMonth: lastMonthRevenueVal, growth: parseFloat(revenueGrowth) },
    expenses: { total: Expense[0]?.total || 0, thisMonth: monthExpenses[0]?.total || 0 },
    profit: { thisMonth: monthRevenueVal - (monthExpenses[0]?.total || 0) },
    pendingPayments: pendingPayments[0]?.total || 0,
    customers: { total: totalCustomers, active: activeCustomers },
    leads: { total: totalLeads, converted: convertedLeads, conversionRate: totalLeads > 0 ? ((convertedLeads / totalLeads) * 100).toFixed(1) : 0 },
    projects: { active: activeProjects },
    invoices: { overdue: overdueInvoices },
    employees: { total: totalEmployees }
  };

  // Generate AI insights
  let aiInsights = null;
  try {
    aiInsights = await aiService.generateBusinessInsights(metrics);
  } catch (err) {
    aiInsights = { insights: [], healthScore: 70 };
  }

  res.json({
    success: true,
    data: {
      kpis: metrics,
      charts: { monthlyRevenue, monthlyExpenses, leadFunnel, expenseBreakdown },
      recentInvoices,
      topCustomers,
      aiInsights
    }
  });
};

// @desc    Get mini dashboard stats for modules
// @route   GET /api/dashboard/mini/:module
exports.getMiniStats = async (req, res) => {
  const { module } = req.params;
  let stats = {};

  switch (module) {
    case 'customers':
      stats = {
        total: await Customer.countDocuments({ isCancelled: false }),
        active: await Customer.countDocuments({ status: 'active' }),
        new: await Customer.countDocuments({ createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } })
      };
      break;
    case 'invoices':
      const invStats = await Invoice.aggregate([{ $group: { _id: '$status', count: { $sum: 1 }, total: { $sum: '$pricing.grandTotal' } } }]);
      stats = invStats.reduce((acc, s) => ({ ...acc, [s._id]: { count: s.count, total: s.total } }), {});
      break;
    case 'leads':
      const leadStats = await Lead.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]);
      stats = leadStats.reduce((acc, s) => ({ ...acc, [s._id]: s.count }), {});
      break;
    default:
      stats = { message: 'Module not found' };
  }

  res.json({ success: true, data: stats });
};
