require('dotenv').config();
require('express-async-errors');

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const fileUpload = require('express-fileupload');
const path = require('path');

const connectDB = require('./config/database');
const logger = require('./config/logger');
const errorHandler = require('./middleware/errorHandler');
const { scheduleJobs } = require('./services/scheduler');

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const companyRoutes = require('./routes/company');
const { companyUploadRouter } = require('./routes/companyUpload');
const customerRoutes = require('./routes/customers');
const invoiceRoutes = require('./routes/invoices');
const quotationRoutes = require('./routes/quotations');
const paymentRoutes = require('./routes/payments');
const supplierRoutes = require('./routes/suppliers');
const purchaseRoutes = require('./routes/purchases');
const expenseRoutes = require('./routes/expenses');
const employeeRoutes = require('./routes/employees');
const salaryRoutes = require('./routes/salaries');
const productRoutes = require('./routes/products');
const ledgerRoutes = require('./routes/ledger');
const reportRoutes = require('./routes/reports');
const projectRoutes = require('./routes/projects');
const scrumRoutes = require('./routes/scrum');
const leadRoutes = require('./routes/leads');
const dashboardRoutes = require('./routes/dashboard');
const aiRoutes = require('./routes/ai');
const cancelledRoutes = require('./routes/cancelled');
const auditorRoutes = require('./routes/auditor');

const app = express();

connectDB();

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' }
  })
);

app.use(
  cors({
    origin: process.env.FRONTEND_URL || '*',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  })
);

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500
});

app.use('/api', limiter);

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

app.use(
  fileUpload({
    limits: {
      fileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760', 10)
    },
    createParentPath: true,
    useTempFiles: true,
    tempFileDir: '/tmp/'
  })
);

if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
}

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'Excerpt ERP API is running',
    timestamp: new Date().toISOString()
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/company/upload', companyUploadRouter);
app.use('/api/company', companyRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/quotations', quotationRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/suppliers', supplierRoutes);
app.use('/api/purchases', purchaseRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/salaries', salaryRoutes);
app.use('/api/products', productRoutes);
app.use('/api/ledger', ledgerRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/scrum', scrumRoutes);
app.use('/api/leads', leadRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/cancelled', cancelledRoutes);
app.use('/api/auditor', auditorRoutes);

app.use('/api/*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`
  });
});

const FRONTEND_DIST_PATH = path.join(__dirname, 'dist');

app.use(express.static(FRONTEND_DIST_PATH, { index: false }));

app.get('*', (req, res, next) => {
  if (
    req.originalUrl.startsWith('/api') ||
    req.originalUrl.startsWith('/assets') ||
    req.originalUrl.startsWith('/uploads') ||
    req.originalUrl.includes('.')
  ) {
    return next();
  }

  res.sendFile(path.join(FRONTEND_DIST_PATH, 'index.html'));
});

app.use(errorHandler);

scheduleJobs();

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  logger.info(`🚀 Server running on port ${PORT}`);
});

process.on('unhandledRejection', (err) => {
  logger.error(`Unhandled Rejection: ${err.message}`);
  server.close(() => process.exit(1));
});

module.exports = app;