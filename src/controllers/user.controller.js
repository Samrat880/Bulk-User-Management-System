import fs from "fs";
import path from "path";
import csv from "csv-parser";
import { Parser } from "json2csv";
import { v4 as uuidv4 } from "uuid";
import User from "../models/user.model.js";
import { createJob, getJob, updateJob } from "../utils/jobStore.js";

// POST /api/users/upload - Bulk upload users via CSV or JSON
export const bulkUpload = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const ext = path.extname(req.file.originalname).toLowerCase();
    const jobId = uuidv4();
    const job = createJob(jobId);

    res.status(202).json({
      message: "File received. Processing in background.",
      jobId,
    });

    if (ext === ".csv") {
      processCSV(req.file.path, job);
    } else if (ext === ".json") {
      processJSON(req.file.path, job);
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Background CSV processing
const processCSV = (filePath, job) => {
  const users = [];

  fs.createReadStream(filePath)
    .pipe(csv())
    .on("data", (row) => {
      users.push({
        fullName: row.fullName,
        email: row.email,
        phone: row.phone,
        walletBalance: row.walletBalance ? Number(row.walletBalance) : 0,
        isBlocked: row.isBlocked === "true",
        kycStatus: row.kycStatus || "Pending",
        deviceInfo: {
          ipAddress: row.ipAddress || undefined,
          deviceType: row.deviceType || undefined,
          os: row.os || undefined,
        },
      });
    })
    .on("end", async () => {
      await insertUsers(users, job);
      fs.unlink(filePath, () => {});
    })
    .on("error", (err) => {
      updateJob(job.id, { status: "failed", errors: [err.message] });
      fs.unlink(filePath, () => {});
    });
};

// Background JSON processing
const processJSON = async (filePath, job) => {
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    const users = JSON.parse(raw);

    if (!Array.isArray(users)) {
      updateJob(job.id, {
        status: "failed",
        errors: ["JSON file must contain an array of users"],
      });
      fs.unlink(filePath, () => {});
      return;
    }

    await insertUsers(users, job);
    fs.unlink(filePath, () => {});
  } catch (err) {
    updateJob(job.id, { status: "failed", errors: [err.message] });
    fs.unlink(filePath, () => {});
  }
};

// Insert users in batches
const insertUsers = async (users, job) => {
  const BATCH_SIZE = 100;
  job.total = users.length;
  let processed = 0;
  let failed = 0;
  const errors = [];

  for (let i = 0; i < users.length; i += BATCH_SIZE) {
    const batch = users.slice(i, i + BATCH_SIZE);
    try {
      const result = await User.insertMany(batch, { ordered: false });
      processed += result.length;
    } catch (err) {
      if (err.insertedDocs) {
        processed += err.insertedDocs.length;
      }
      if (err.writeErrors) {
        failed += err.writeErrors.length;
        err.writeErrors.forEach((e) => errors.push(e.errmsg));
      } else {
        failed += batch.length;
        errors.push(err.message);
      }
    }

    updateJob(job.id, { processed, failed, errors });
  }

  updateJob(job.id, {
    status: "completed",
    processed,
    failed,
    errors,
  });
};

// GET /api/users - List users with filtering, searching, sorting, pagination
export const getUsers = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search,
      kycStatus,
      isBlocked,
      sortBy = "createdAt",
      order = "desc",
    } = req.query;

    const filter = {};

    if (search) {
      filter.$or = [
        { fullName: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
      ];
    }

    if (kycStatus) filter.kycStatus = kycStatus;
    if (isBlocked !== undefined) filter.isBlocked = isBlocked === "true";

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sortOrder = order === "asc" ? 1 : -1;

    const [users, total] = await Promise.all([
      User.find(filter)
        .sort({ [sortBy]: sortOrder })
        .skip(skip)
        .limit(parseInt(limit)),
      User.countDocuments(filter),
    ]);

    res.json({
      users,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// PUT /api/users/bulk-update - Bulk update users
export const bulkUpdate = async (req, res) => {
  try {
    const { userIds, filter, update } = req.body;

    if (!update || Object.keys(update).length === 0) {
      return res.status(400).json({ error: "Update fields are required" });
    }

    const allowedFields = [
      "fullName",
      "phone",
      "walletBalance",
      "isBlocked",
      "kycStatus",
    ];
    const safeUpdate = {};
    for (const key of Object.keys(update)) {
      if (allowedFields.includes(key)) {
        safeUpdate[key] = update[key];
      }
    }

    let query = {};
    if (userIds && userIds.length > 0) {
      query._id = { $in: userIds };
    } else if (filter) {
      if (filter.kycStatus) query.kycStatus = filter.kycStatus;
      if (filter.isBlocked !== undefined) query.isBlocked = filter.isBlocked;
    } else {
      return res
        .status(400)
        .json({ error: "Provide userIds or filter criteria" });
    }

    const result = await User.updateMany(query, { $set: safeUpdate });

    res.json({
      message: "Users updated successfully",
      matchedCount: result.matchedCount,
      modifiedCount: result.modifiedCount,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// DELETE /api/users/bulk-delete - Bulk delete users
export const bulkDelete = async (req, res) => {
  try {
    const { userIds, filter } = req.body;

    let query = {};
    if (userIds && userIds.length > 0) {
      query._id = { $in: userIds };
    } else if (filter) {
      if (filter.kycStatus) query.kycStatus = filter.kycStatus;
      if (filter.isBlocked !== undefined) query.isBlocked = filter.isBlocked;
    } else {
      return res
        .status(400)
        .json({ error: "Provide userIds or filter criteria" });
    }

    const result = await User.deleteMany(query);

    res.json({
      message: "Users deleted successfully",
      deletedCount: result.deletedCount,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// GET /api/users/export - Export users as CSV or JSON
export const exportUsers = async (req, res) => {
  try {
    const { format = "json", kycStatus, isBlocked } = req.query;

    const filter = {};
    if (kycStatus) filter.kycStatus = kycStatus;
    if (isBlocked !== undefined) filter.isBlocked = isBlocked === "true";

    const users = await User.find(filter).lean();

    if (format === "csv") {
      const fields = [
        "fullName",
        "email",
        "phone",
        "walletBalance",
        "isBlocked",
        "kycStatus",
        "createdAt",
      ];
      const parser = new Parser({ fields });
      const csvData = parser.parse(users);

      res.header("Content-Type", "text/csv");
      res.header("Content-Disposition", "attachment; filename=users.csv");
      return res.send(csvData);
    }

    res.header("Content-Type", "application/json");
    res.header("Content-Disposition", "attachment; filename=users.json");
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// GET /api/users/job/:jobId - Get job status
export const getJobStatus = async (req, res) => {
  try {
    const { jobId } = req.params;
    const job = getJob(jobId);

    if (!job) {
      return res.status(404).json({ error: "Job not found" });
    }

    res.json({
      jobId: job.id,
      status: job.status,
      total: job.total,
      processed: job.processed,
      failed: job.failed,
      errors: job.errors.slice(0, 20),
      createdAt: job.createdAt,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
