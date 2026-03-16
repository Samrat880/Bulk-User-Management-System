const errorHandler = (err, req, res, next) => {
  console.error(`Error: ${err.message}`);

  // Multer file upload errors
  if (err.name === "MulterError") {
    return res.status(400).json({ error: `Upload error: ${err.message}` });
  }

  // Multer file filter error (invalid file type)
  if (err.message === "Only CSV and JSON files are allowed") {
    return res.status(400).json({ error: err.message });
  }

  // Mongoose validation error
  if (err.name === "ValidationError") {
    const messages = Object.values(err.errors).map((e) => e.message);
    return res.status(400).json({ error: "Validation failed", details: messages });
  }

  // Mongoose cast error (invalid ObjectId etc.)
  if (err.name === "CastError") {
    return res.status(400).json({ error: `Invalid value for ${err.path}: ${err.value}` });
  }

  // Mongoose duplicate key error
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue).join(", ");
    return res.status(409).json({ error: `Duplicate value for: ${field}` });
  }

  // Default server error
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    error: statusCode === 500 ? "Internal server error" : err.message,
  });
};

export default errorHandler;
