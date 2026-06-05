const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
  employee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee'
  },

  employeeCode: String,
  employeeName: String,
  department: String,

  date: Date,

  status: {
    type: String,
    enum: ['present', 'absent', 'halfday']
  },

  checkInTime: Date,

  checkOutTime: Date,

  totalHours: Number,

  month: Number,
  year: Number
}, { timestamps: true });


attendanceSchema.index(
{
    employee: 1,
    date: 1
},
{
    unique: true
});

module.exports = mongoose.model(
    'Attendance',
    attendanceSchema
);