import { Router } from "express";
import upload from "../middleware/upload.js";
import {
  bulkUpload,
  getUsers,
  bulkUpdate,
  bulkDelete,
  exportUsers,
  getJobStatus,
} from "../controllers/user.controller.js";

const router = Router();

// Bulk upload users via CSV/JSON file
router.post("/upload", upload.single("file"), bulkUpload);

// List users with filtering, searching, sorting, pagination
router.get("/", getUsers);

// Export users as CSV or JSON
router.get("/export", exportUsers);

// Get background job status
router.get("/job/:jobId", getJobStatus);

// Bulk update users
router.put("/bulk-update", bulkUpdate);

// Bulk delete users
router.delete("/bulk-delete", bulkDelete);

export default router;
