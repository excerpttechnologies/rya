require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const connectDB = async () => {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/excerpt_erp');
  console.log('MongoDB connected for seeding');
};

const seed = async () => {
  await connectDB();

  const User = require('../models/User');
  const Company = require('../models/Company');
  const Customer = require('../models/Customer');
  const { Lead, Employee } = require('../models/index');

  // Clear existing data
  await Promise.all([User.deleteMany({}), Company.deleteMany({}), Customer.deleteMany({}), Lead.deleteMany({}), Employee.deleteMany({})]);
  console.log('Cleared existing data');

  // Create company
  await Company.create({
    name: 'Excerpt Technologies Pvt Ltd',
    tagline: 'Building Tomorrow\'s Technology Today',
    gstin: '27AAACE1234F1Z5',
    pan: 'AAACE1234F',
    address: { line1: '4th Floor, Tech Park', line2: 'Sector 5', city: 'Pune', state: 'Maharashtra', pincode: '411001' },
    phone: '+91 20 1234 5678',
    email: 'info@excerpt.tech',
    website: 'https://excerpt.tech',
    bank: { bankName: 'HDFC Bank', accountNumber: '50100123456789', ifscCode: 'HDFC0001234', accountType: 'Current', branchName: 'Pune Main', upiId: 'excerpt@hdfcbank' },
    invoiceSettings: { prefix: 'INV', nextNumber: 1001 },
    quotationSettings: { prefix: 'QT', nextNumber: 1001 },
    gstSettings: { cgstPercent: 9, sgstPercent: 9, igstPercent: 18 },
  });
  console.log('✅ Company created');

  // Create users
  const users = await User.create([
    { name: 'Super Admin', email: 'admin@excerpt.tech', password: 'admin123', role: 'super_admin' },
    { name: 'Rahul Sharma', email: 'rahul@excerpt.tech', password: 'manager123', role: 'manager' },
    { name: 'Priya Scrum', email: 'scrum@excerpt.tech', password: 'scrum123', role: 'scrum_master' },
    { name: 'Anita HR', email: 'hr@excerpt.tech', password: 'hr123456', role: 'hr' },
    { name: 'Vijay Accounts', email: 'accounts@excerpt.tech', password: 'accounts123', role: 'accountant' },
  ]);
  console.log('✅ Users created:', users.length);

  // Create customers
  const customers = [
  {
    name: 'Arun Patel',
    companyName: 'TechVision Solutions',
    email: 'arun@techvision.com',
    phone: '9876543210',
    category: 'ERP',
    status: 'active',
    requirements: [{
      partLabel: 'A',
      partName: 'Core ERP',
      items: [
        { description: 'Custom ERP Development', quantity: 1, unitPrice: 150000 },
        { description: 'User Training', quantity: 5, unitPrice: 5000 }
      ]
    }],
    pricing: { gstPercent: 18 },
    address: { city: 'Mumbai', state: 'Maharashtra' }
  },

  {
    name: 'Sunita Reddy',
    companyName: 'E-Commerce Pro',
    email: 'sunita@ecompro.in',
    phone: '8765432109',
    category: 'Ecommerce',
    status: 'active',
    requirements: [{
      partLabel: 'A',
      partName: 'Store Development',
      items: [
        { description: 'Multi-vendor E-commerce Platform', quantity: 1, unitPrice: 200000 }
      ]
    }],
    pricing: { gstPercent: 18 },
    address: { city: 'Bangalore', state: 'Karnataka' }
  },

  {
    name: 'Vikram Shah',
    companyName: 'Digital Academy',
    email: 'vikram@digitalacademy.edu',
    phone: '7654321098',
    category: 'E-learning',
    status: 'prospect',
    requirements: [{
      partLabel: 'A',
      partName: 'LMS Platform',
      items: [
        { description: 'Learning Management System', quantity: 1, unitPrice: 120000 }
      ]
    }],
    pricing: { gstPercent: 18 },
    address: { city: 'Delhi', state: 'Delhi' }
  }
];

for (const customer of customers) {
   await Customer.create(customer);
}

console.log('✅ Customers created');
  console.log('✅ Customers created');

  // Create leads
  await Lead.create([
    { name: 'Kiran Mehta', email: 'kiran@startup.in', phone: '9123456789', companyName: 'StartupX', category: 'CRM', status: 'new', source: 'website', shortRequirement: 'Need a CRM for sales team of 20 people', priority: 'high', estimatedValue: 80000 },
    { name: 'Deepa Iyer', email: 'deepa@retail.com', phone: '8123456789', companyName: 'Retail Masters', category: 'Ecommerce', status: 'follow_up', source: 'referral', shortRequirement: 'B2B ecommerce platform', priority: 'medium', estimatedValue: 150000 },
    { name: 'Arjun Nair', email: 'arjun@logistics.co', phone: '7123456789', companyName: 'LogiTech', category: 'ERP', status: 'quotation_sent', source: 'cold_call', shortRequirement: 'Fleet management and ERP integration', priority: 'urgent', estimatedValue: 300000 },
    { name: 'Meera Krishnan', email: 'meera@school.edu', phone: '6123456789', companyName: 'Bright Schools', category: 'E-learning', status: 'contacted', source: 'social', shortRequirement: 'School management system with e-learning', priority: 'low', estimatedValue: 90000 },
  ]);
  console.log('✅ Leads created');

  // Create employees
const employees = [
  {
    name: 'Rohan Kumar',
    email: 'rohan@excerpt.tech',
    phone: '9001234567',
    department: 'Engineering',
    designation: 'Senior Developer',
    joiningDate: new Date('2022-01-15'),
    baseSalary: 75000,
    employmentType: 'full_time',
    skills: ['React', 'Node.js', 'MongoDB']
  },
  {
    name: 'Sneha Patil',
    email: 'sneha@excerpt.tech',
    phone: '9001234568',
    department: 'Design',
    designation: 'UI/UX Designer',
    joiningDate: new Date('2022-06-01'),
    baseSalary: 55000,
    employmentType: 'full_time',
    skills: ['Figma', 'Adobe XD', 'CSS']
  },
  {
    name: 'Amit Gupta',
    email: 'amit@excerpt.tech',
    phone: '9001234569',
    department: 'Engineering',
    designation: 'Backend Developer',
    joiningDate: new Date('2023-03-10'),
    baseSalary: 65000,
    employmentType: 'full_time',
    skills: ['Python', 'Django', 'PostgreSQL']
  },
  {
    name: 'Pooja Nambiar',
    email: 'pooja@excerpt.tech',
    phone: '9001234570',
    department: 'Sales',
    designation: 'Business Development Manager',
    joiningDate: new Date('2021-09-20'),
    baseSalary: 60000,
    employmentType: 'full_time'
  },
  {
    name: 'Siddharth Jain',
    email: 'sid@excerpt.tech',
    phone: '9001234571',
    department: 'Engineering',
    designation: 'Junior Developer',
    joiningDate: new Date('2023-11-01'),
    baseSalary: 35000,
    employmentType: 'full_time',
    skills: ['JavaScript', 'React']
  }
];

for (const emp of employees) {
  await Employee.create(emp);
}

console.log('✅ Employees created');

  console.log('\n🎉 Database seeded successfully!');
  console.log('📧 Login: admin@excerpt.tech / admin123');
  process.exit(0);
};

seed().catch(err => { console.error('Seeding failed:', err); process.exit(1); });
