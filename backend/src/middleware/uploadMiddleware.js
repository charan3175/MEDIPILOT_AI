
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const uploadDir = path.resolve(__dirname, "../../private_uploads");

fs.mkdirSync(uploadDir, { recursive: true });

const allowedTypes = {
  "application/pdf": ".pdf",
  "image/jpeg": ".jpg",
  "image/png": ".png",
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },

  filename: (req, file, cb) => {
    const extension = allowedTypes[file.mimetype];

    if (!extension) {
      return cb(new Error("Only PDF, JPG and PNG files are allowed."));
    }

    cb(null, `${crypto.randomUUID()}${extension}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 1,
  },
  fileFilter: (req, file, cb) => {
    if (!allowedTypes[file.mimetype]) {
      return cb(new Error("Only PDF, JPG and PNG files are allowed."));
    }

    cb(null, true);
  },
});

module.exports = { upload };
