const User = require('../models/User');
const Company = require('../models/Company');
const logger = require('../config/logger');

// @desc    Register user
// @route   POST /api/auth/register
exports.register = async (req, res) => {
  const { name, email, password, role, department, designation } = req.body;
  
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    return res.status(400).json({ success: false, message: 'Email already registered' });
  }

  const user = await User.create({ name, email, password, role: role || 'employee', department, designation });
  
  // Create default company if first user
  const companyCount = await Company.countDocuments();
  if (companyCount === 0) {
    await Company.create({ name: process.env.COMPANY_NAME || 'Excerpt Technologies Pvt Ltd' });
  }

  sendTokenResponse(user, 201, res, 'Registration successful');
};

// @desc    Login user
// @route   POST /api/auth/login
exports.login = async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'Please provide email and password' });
  }

  const user = await User.findOne({ email }).select('+password');
  if (!user || !user.isActive) {
    return res.status(401).json({ success: false, message: 'Invalid credentials or account inactive' });
  }

  const isMatch = await user.matchPassword(password);
  if (!isMatch) {
    return res.status(401).json({ success: false, message: 'Invalid credentials' });
  }

  user.lastLogin = new Date();
  user.loginHistory.push({ timestamp: new Date(), ip: req.ip, userAgent: req.headers['user-agent'] });
  if (user.loginHistory.length > 20) user.loginHistory = user.loginHistory.slice(-20);
  await user.save({ validateBeforeSave: false });

  logger.info(`User logged in: ${email}`);
  sendTokenResponse(user, 200, res, 'Login successful');
};

// @desc    Get current user
// @route   GET /api/auth/me
exports.getMe = async (req, res) => {
  const user = await User.findById(req.user.id);
  res.json({ success: true, data: user });
};

// @desc    Update password
// @route   PUT /api/auth/password
exports.updatePassword = async (req, res) => {
  const user = await User.findById(req.user.id).select('+password');
  if (!(await user.matchPassword(req.body.currentPassword))) {
    return res.status(400).json({ success: false, message: 'Current password is incorrect' });
  }
  user.password = req.body.newPassword;
  await user.save();
  sendTokenResponse(user, 200, res, 'Password updated successfully');
};

// @desc    Update profile
// @route   PUT /api/auth/profile
exports.updateProfile = async (req, res) => {
  const fields = ['name', 'phone', 'preferences', 'designation', 'department'];
  const updateData = {};
  fields.forEach(f => { if (req.body[f] !== undefined) updateData[f] = req.body[f]; });
  
  const user = await User.findByIdAndUpdate(req.user.id, updateData, { new: true, runValidators: true });
  res.json({ success: true, data: user, message: 'Profile updated' });
};

// @desc    Logout (client-side, just for logging)
// @route   POST /api/auth/logout
exports.logout = async (req, res) => {
  logger.info(`User logged out: ${req.user.email}`);
  res.json({ success: true, message: 'Logged out successfully' });
};

const sendTokenResponse = (user, statusCode, res, message) => {
  const token = user.getSignedJwtToken();
  res.status(statusCode).json({
    success: true,
    message,
    token,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      permissions: user.permissions,
      avatar: user.avatar,
      preferences: user.preferences,
      department: user.department,
      designation: user.designation,
      lastLogin: user.lastLogin
    }
  });
};
