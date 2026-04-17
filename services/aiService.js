const logger = require('../config/logger');

/**
 * Groq AI Service - Replaces OpenAI
 * Uses Groq SDK for fast inference with LLaMA models
 * Get your API key: https://console.groq.com/keys
 */
class AIService {
  constructor() {
    this.apiKey = process.env.GROQ_API_KEY;
    this.model = process.env.GROQ_MODEL || 'llama3-8b-8192';
    this.baseURL = 'https://api.groq.com/openai/v1';

    if (!this.apiKey) {
      logger.warn('⚠️  GROQ_API_KEY not set. AI features will return smart mock responses.');
    } else {
      logger.info(`✅ Groq AI initialized with model: ${this.model}`);
    }
  }

  async chat(messages, systemPrompt = '', options = {}) {
    if (!this.apiKey) {
      return this._smartMock(messages[messages.length - 1]?.content || '', options.jsonMode);
    }

    try {
      const Groq = require('groq-sdk');
      const groq = new Groq({ apiKey: this.apiKey });

      const response = await groq.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: systemPrompt || 'You are an intelligent ERP assistant for Excerpt Technologies Pvt Ltd, an IT company. Be concise, professional, and data-driven. Always respond in valid JSON when requested.'
          },
          ...messages
        ],
        temperature: options.temperature || 0.3,
        max_tokens: options.maxTokens || 1024,
      });

      return response.choices[0].message.content;
    } catch (error) {
      logger.error(`Groq AI Error: ${error.message}`);
      return this._smartMock(messages[messages.length - 1]?.content || '', options.jsonMode);
    }
  }

  _smartMock(prompt, jsonMode) {
    if (!jsonMode) {
      return `I'm your ERP AI assistant. Based on your query about "${prompt.substring(0, 50)}...", here are my recommendations: Ensure all data is up to date and review the relevant module for actionable insights.`;
    }
    // Return intelligent mock JSON based on prompt content
    const p = prompt.toLowerCase();
    if (p.includes('pricing') || p.includes('price')) {
      return JSON.stringify({ basePrice: 75000, suggestedRangeMin: 60000, suggestedRangeMax: 120000, breakdown: [{ item: 'Development', price: 50000 }, { item: 'Testing', price: 15000 }, { item: 'Deployment', price: 10000 }], reasoning: 'Based on market rates for IT services', maintenanceSuggestion: 15000, confidence: 0.75 });
    }
    if (p.includes('lead') || p.includes('conversion')) {
      return JSON.stringify({ conversionScore: 72, priority: 'high', suggestedAction: 'Schedule a product demo within 48 hours', reasoning: 'High engagement signals detected', estimatedDealValue: 85000, followUpDays: 2 });
    }
    if (p.includes('expense') || p.includes('categori')) {
      return JSON.stringify({ category: 'Software', confidence: 0.88, reasoning: 'Description matches software licensing pattern' });
    }
    if (p.includes('invoice') || p.includes('error')) {
      return JSON.stringify({ errors: [], warnings: [], overallStatus: 'ok', improvements: ['Consider adding payment terms', 'Add project reference number'] });
    }
    if (p.includes('risk') || p.includes('project')) {
      return JSON.stringify({ riskScore: 35, delayProbability: 20, criticalRisks: [{ risk: 'Resource availability', impact: 'medium', mitigation: 'Pre-book developers' }], recommendedActions: ['Weekly check-ins', 'Buffer time in schedule'], estimatedDelay: '3-5 days', healthStatus: 'on_track' });
    }
    if (p.includes('insight') || p.includes('business')) {
      return JSON.stringify({ insights: [{ title: 'Revenue Growth Opportunity', description: 'Upsell maintenance contracts to active clients', impact: 'positive', priority: 'high', action: 'Contact top 5 clients this week' }, { title: 'Expense Optimization', description: 'Software subscriptions can be consolidated', impact: 'positive', priority: 'medium', action: 'Review SaaS stack' }], forecast: { nextMonthRevenue: 180000, growth: 12, trend: 'growing' }, healthScore: 78, alerts: [] });
    }
    if (p.includes('forecast') || p.includes('revenue')) {
      return JSON.stringify({ forecast: [{ month: 'Next Month', year: 2024, predictedRevenue: 185000, confidence: 0.8 }, { month: 'Month+2', year: 2024, predictedRevenue: 210000, confidence: 0.7 }, { month: 'Month+3', year: 2024, predictedRevenue: 195000, confidence: 0.65 }], trend: 'growing', growthRate: 12.5, keyFactors: ['Seasonal demand', 'New client onboarding'] });
    }
    if (p.includes('customer') || p.includes('health')) {
      return JSON.stringify({ conversionProbability: 65, healthScore: 78, riskLevel: 'low', churnRisk: 15, lifetimeValue: 350000, recommendations: ['Schedule quarterly review', 'Offer premium support plan'] });
    }
    if (p.includes('vendor') || p.includes('supplier')) {
      return JSON.stringify({ recommended: { supplierId: null, name: 'Best match supplier', reasoning: 'Highest rating with competitive pricing' }, alternatives: [], costOptimizationTips: ['Negotiate bulk discounts', 'Consider annual contracts'] });
    }
    return JSON.stringify({ success: true, message: 'AI analysis complete', data: {}, timestamp: new Date().toISOString() });
  }

  // ---- Pricing Suggestion ----
  async suggestPricing(category, requirements, historicalData = []) {
    const prompt = `Based on project category "${category}" and requirements: ${JSON.stringify(requirements)}, suggest pricing. Historical: ${JSON.stringify(historicalData.slice(0, 3))}. Return JSON: { basePrice, suggestedRangeMin, suggestedRangeMax, breakdown: [{item, price}], reasoning, maintenanceSuggestion, confidence }`;
    const res = await this.chat([{ role: 'user', content: prompt }], '', { jsonMode: true });
    try { return JSON.parse(res); } catch { return JSON.parse(this._smartMock(prompt, true)); }
  }

  // ---- Lead Scoring ----
  async scoreLead(lead) {
    const prompt = `Score this IT lead on conversion probability (0-100). Lead: ${JSON.stringify(lead)}. Return JSON: { conversionScore, priority, suggestedAction, reasoning, estimatedDealValue, followUpDays }`;
    const res = await this.chat([{ role: 'user', content: prompt }], '', { jsonMode: true });
    try { return JSON.parse(res); } catch { return JSON.parse(this._smartMock('lead conversion', true)); }
  }

  // ---- Invoice Error Detection ----
  async detectInvoiceErrors(invoiceData) {
    const prompt = `Review invoice data for errors: ${JSON.stringify(invoiceData)}. Return JSON: { errors: [{field, issue, suggestion}], warnings: [{field, issue}], overallStatus: 'ok'|'warning'|'error', improvements: [string] }`;
    const res = await this.chat([{ role: 'user', content: prompt }], '', { jsonMode: true });
    try { return JSON.parse(res); } catch { return { errors: [], warnings: [], overallStatus: 'ok', improvements: [] }; }
  }

  // ---- Payment Prediction ----
  async predictPayment(invoice, customerHistory) {
    const prompt = `Predict payment likelihood. Invoice: ${JSON.stringify(invoice)}, History: ${JSON.stringify(customerHistory)}. Return JSON: { latePaymentRisk: 'low'|'medium'|'high', predictedPaymentDate, daysToPay, recommendedAction }`;
    const res = await this.chat([{ role: 'user', content: prompt }], '', { jsonMode: true });
    try { return JSON.parse(res); } catch { return { latePaymentRisk: 'medium', recommendedAction: 'Send reminder in 7 days' }; }
  }

  // ---- Expense Auto-Categorize ----
  async categorizeExpense(description, amount) {
    const prompt = `Categorize expense for IT company: "${description}", ₹${amount}. Categories: [Rent, Electricity, Water, Internet, Xerox, Certificates, Salary, Marketing, Travel, Food, Equipment, Software, Maintenance, Legal, Misc]. Return JSON: { category, confidence, reasoning }`;
    const res = await this.chat([{ role: 'user', content: prompt }], '', { jsonMode: true });
    try { return JSON.parse(res); } catch { return JSON.parse(this._smartMock('expense categori', true)); }
  }

  // ---- Project Risk Analysis ----
  async analyzeProjectRisk(project) {
    const prompt = `Analyze IT project risks: ${JSON.stringify(project)}. Return JSON: { riskScore: number, delayProbability: number, criticalRisks: [{risk, impact, mitigation}], recommendedActions: [string], estimatedDelay: string, healthStatus: 'on_track'|'at_risk'|'critical' }`;
    const res = await this.chat([{ role: 'user', content: prompt }], '', { jsonMode: true });
    try { return JSON.parse(res); } catch { return JSON.parse(this._smartMock('risk project', true)); }
  }

  // ---- Business Insights ----
  async generateBusinessInsights(metrics) {
    const prompt = `Generate business insights for IT company: ${JSON.stringify(metrics)}. Return JSON: { insights: [{title, description, impact: 'positive'|'negative'|'neutral', priority: 'high'|'medium'|'low', action}], forecast: { nextMonthRevenue, growth, trend }, healthScore: number, alerts: [{type, message}] }`;
    const res = await this.chat([{ role: 'user', content: prompt }], '', { jsonMode: true, maxTokens: 1500 });
    try { return JSON.parse(res); } catch { return JSON.parse(this._smartMock('insight business', true)); }
  }

  // ---- ERP Copilot Chat ----
  async copilotChat(userMessage, context = {}) {
    const systemPrompt = `You are an AI ERP Copilot for Excerpt Technologies Pvt Ltd. Help with: invoices, payments, leads, reports, expenses, employees, scrum. Context: ${JSON.stringify(context)}. Be concise. For navigation actions, respond: { text: "response", action: { type: "navigate", target: "modulename" } }`;
    const res = await this.chat([{ role: 'user', content: userMessage }], systemPrompt);
    try { return JSON.parse(res); } catch { return { text: res, action: null }; }
  }

  // ---- Quotation Wording Improvement ----
  async improveQuotationWording(text) {
    const prompt = `Improve this quotation text to be professional and compelling for an IT services company: "${text}". Return only the improved text, no explanations.`;
    return await this.chat([{ role: 'user', content: prompt }], '', { temperature: 0.6 });
  }

  // ---- Revenue Forecast ----
  async forecastRevenue(historicalData, months = 3) {
    const prompt = `Forecast next ${months} months revenue for IT company. Historical: ${JSON.stringify(historicalData)}. Return JSON: { forecast: [{month, year, predictedRevenue, confidence}], trend: 'growing'|'stable'|'declining', growthRate: number, keyFactors: [string] }`;
    const res = await this.chat([{ role: 'user', content: prompt }], '', { jsonMode: true });
    try { return JSON.parse(res); } catch { return JSON.parse(this._smartMock('forecast revenue', true)); }
  }

  // ---- Vendor Recommendation ----
  async recommendVendor(requirement, suppliers) {
    const prompt = `For requirement: "${requirement}", suppliers: ${JSON.stringify(suppliers)}. Return JSON: { recommended: { supplierId, name, reasoning }, alternatives: [{supplierId, name, pros, cons}], costOptimizationTips: [string] }`;
    const res = await this.chat([{ role: 'user', content: prompt }], '', { jsonMode: true });
    try { return JSON.parse(res); } catch { return JSON.parse(this._smartMock('vendor supplier', true)); }
  }

  // ---- Customer Scoring ----
  async scoreCustomer(customer, transactions) {
    const prompt = `Score customer health: ${JSON.stringify({ customer, transactions })}. Return JSON: { conversionProbability: number, healthScore: number, riskLevel: 'low'|'medium'|'high', churnRisk: number, lifetimeValue: number, recommendations: [string] }`;
    const res = await this.chat([{ role: 'user', content: prompt }], '', { jsonMode: true });
    try { return JSON.parse(res); } catch { return JSON.parse(this._smartMock('customer health', true)); }
  }

  // ---- Scrum Productivity ----
  async scoreScrumProductivity(entries) {
    const prompt = `Score team productivity from scrum data: ${JSON.stringify(entries)}. Return JSON: { overallScore: number, insights: [string], teamHealthStatus: 'excellent'|'good'|'average'|'poor', recommendations: [string] }`;
    const res = await this.chat([{ role: 'user', content: prompt }], '', { jsonMode: true });
    try { return JSON.parse(res); } catch { return { overallScore: 75, insights: ['Team is performing well'], teamHealthStatus: 'good', recommendations: ['Continue daily standups'] }; }
  }
}

module.exports = new AIService();
