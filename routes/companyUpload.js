// FILE: backend/routes/companyUpload.js
// Uses express-fileupload (already globally mounted in server.js)
// NO multer needed — removing that conflict!

const express = require('express');
const path    = require('path');
const fs      = require('fs');
const { protect, checkPermission } = require('../middleware/auth');

const companyUploadRouter = express.Router();
companyUploadRouter.use(protect);

// Helper: ensure upload dir exists & save file, return url
function saveFile(file, prefix) {
  const dir = path.join(__dirname, '../uploads/company');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const ext      = path.extname(file.name).toLowerCase() || '.png';
  const filename = `${prefix}-${Date.now()}${ext}`;
  const fullPath = path.join(dir, filename);

  file.mv(fullPath); // express-fileupload's built-in move
  return `/uploads/company/${filename}`;
}

// Helper: delete old file from disk
function deleteOldFile(urlPath) {
  if (!urlPath) return;
  const fullPath = path.join(__dirname, '..', urlPath.replace(/^\//, ''));
  if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
}

// ── POST /api/company/upload/logo ────────────────────────────
companyUploadRouter.post('/logo', checkPermission('company'), async (req, res) => {
  try {
    if (!req.files || !req.files.logo) {
      return res.status(400).json({ success: false, message: 'No logo file uploaded' });
    }

    const file = req.files.logo;

    // Validate type
    const allowed = ['.jpg', '.jpeg', '.png', '.webp', '.svg'];
    const ext = path.extname(file.name).toLowerCase();
    if (!allowed.includes(ext)) {
      return res.status(400).json({ success: false, message: 'Only image files allowed (jpg, png, webp, svg)' });
    }

    // Validate size (2MB)
    if (file.size > 2 * 1024 * 1024) {
      return res.status(400).json({ success: false, message: 'File too large. Max 2MB allowed.' });
    }

    const Company = require('../models/Company');
    let company = await Company.findOne();

    // Delete old logo
    if (company?.logo) deleteOldFile(company.logo);

    // Save new file
    const url = saveFile(file, 'logo');

    // Update DB
    if (!company) company = new Company({ name: 'My Company' });
    company.logo = url;
    await company.save();

    res.json({ success: true, url, message: 'Logo uploaded successfully' });
  } catch (err) {
    console.error('Logo upload error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── POST /api/company/upload/qrcode ─────────────────────────
companyUploadRouter.post('/qrcode', checkPermission('company'), async (req, res) => {
  try {
    if (!req.files || !req.files.qrcode) {
      return res.status(400).json({ success: false, message: 'No QR code file uploaded' });
    }

    const file = req.files.qrcode;

    // Validate type
    const allowed = ['.jpg', '.jpeg', '.png', '.webp', '.svg'];
    const ext = path.extname(file.name).toLowerCase();
    if (!allowed.includes(ext)) {
      return res.status(400).json({ success: false, message: 'Only image files allowed (jpg, png, webp, svg)' });
    }

    // Validate size (2MB)
    if (file.size > 2 * 1024 * 1024) {
      return res.status(400).json({ success: false, message: 'File too large. Max 2MB allowed.' });
    }

    const Company = require('../models/Company');
    let company = await Company.findOne();

    // Delete old QR
    if (company?.qrCode) deleteOldFile(company.qrCode);

    // Save new file
    const url = saveFile(file, 'qrcode');

    // Update DB
    if (!company) company = new Company({ name: 'My Company' });
    company.qrCode = url;
    await company.save();

    res.json({ success: true, url, message: 'QR code uploaded successfully' });
  } catch (err) {
    console.error('QR upload error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports.companyUploadRouter = companyUploadRouter;