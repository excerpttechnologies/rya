const cron = require('node-cron');
const logger = require('../config/logger');

const scheduleJobs = () => {
  // Daily payment reminders at 9 AM
  cron.schedule('0 9 * * *', async () => {
    logger.info('Running daily payment reminder job...');
    try {
      const Invoice = require('../models/Invoice');
      const today = new Date();
      const overdueInvoices = await Invoice.find({
        status: { $in: ['sent', 'partial'] },
        dueDate: { $lt: today }
      }).populate('customer');
      
      for (const invoice of overdueInvoices) {
        if (invoice.status !== 'overdue') {
          invoice.status = 'overdue';
          await invoice.save();
        }
        logger.info(`Overdue invoice marked: ${invoice.invoiceNumber}`);
      }
    } catch (err) {
      logger.error(`Payment reminder job error: ${err.message}`);
    }
  });

  // Weekly business insights generation - Every Monday at 8 AM
  cron.schedule('0 8 * * 1', async () => {
    logger.info('Generating weekly business insights...');
  });

  // Monthly salary reminders - 1st of each month
  cron.schedule('0 10 1 * *', async () => {
    logger.info('Monthly salary reminder triggered');
  });

  // Lead follow-up reminders - Every day at 10 AM
  cron.schedule('0 10 * * *', async () => {
    logger.info('Checking lead follow-up reminders...');
    try {
      const { Lead } = require('../models/index');
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const leadsToFollowUp = await Lead.find({
        status: { $nin: ['converted', 'rejected', 'not_interested'] },
        nextFollowUpDate: { $gte: today, $lt: tomorrow }
      });
      logger.info(`Found ${leadsToFollowUp.length} leads needing follow-up today`);
    } catch (err) {
      logger.error(`Lead follow-up job error: ${err.message}`);
    }
  });

  logger.info('✅ Background jobs scheduled successfully');
};

module.exports = { scheduleJobs };
