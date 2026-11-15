const express = require("express");
const router = express.Router();

const upload = require("../Middleware/uploadPDF");
const isAuthenticated = require("../Middleware/authMiddleware");

const {
  saveInvoice,
  getMyInvoices,
  downloadInvoice,
} = require("../Controllers/invoiceController");

router.post(
  "/save",
  isAuthenticated,
  upload.single("pdf"),
  saveInvoice
);

router.get(
  "/my-invoices",
  isAuthenticated,
  getMyInvoices
);

// Invoice ID is sent in the request body, not the URL.
router.post(
  "/download",
  isAuthenticated,
  downloadInvoice
);

module.exports = router;