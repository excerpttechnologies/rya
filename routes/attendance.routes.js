const express = require("express");

const router = express.Router();

const Attendance = require("../models/Attendance");

const { Employee } = require("../models");

router.get("/", async (req, res) => {
  try {
    const { month, year } = req.query;

    const query = {};

    if (month) query.month = Number(month);

    if (year) query.year = Number(year);

    const data = await Attendance.find(query)
      .populate("employee", "name employeeCode department")
      .sort({ date: -1 });

    res.json({
      success: true,
      data,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
});

router.post("/", async (req, res) => {
  try {
    const records = req.body.records;

 for (const row of records) {

  await Attendance.findOneAndUpdate(
    {
      employee: row.employee,
      date: {
        $gte: new Date(
          new Date(row.date).setHours(0, 0, 0, 0)
        ),
        $lte: new Date(
          new Date(row.date).setHours(23, 59, 59, 999)
        ),
      },
    },
    {
      $set: {
        employeeCode: row.employeeCode,
        employeeName: row.employeeName,
        department: row.department,
        status: row.status,
        month: row.month,
        year: row.year,
        checkInTime: row.checkInTime,
        checkOutTime: row.checkOutTime,
        date: row.date
      }
    },
    {
      upsert: true,
      new: true
    }
  );

}

    res.json({
      success: true,
      message: "Attendance saved",
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
});

router.get("/employee-summary/:employeeId", async (req, res) => {
  try {
    const { employeeId } = req.params;

    const { month, year } = req.query;

    const records = await Attendance.find({
      employee: employeeId,
      month: Number(month),
      year: Number(year),
    });

    const presentDays = records.filter((x) => x.status === "present").length;

    const absentDays = records.filter((x) => x.status === "absent").length;

    const halfDays = records.filter((x) => x.status === "halfday").length;

   const totalDays =
  presentDays +
  (halfDays * 0.5);

res.json({
  success: true,
  data: {
    presentDays,
    absentDays,
    halfDays,
    totalDays
  }
});
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
});

module.exports = router;
