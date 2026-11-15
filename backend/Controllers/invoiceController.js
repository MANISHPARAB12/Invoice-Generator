
const mongoose = require("mongoose");
const { GridFSBucket } = require("mongodb");
const { Readable } = require("stream");

const Invoice = require("../Models/Invoice");

// ========================================
// 1. SAVE INVOICE
// ========================================

const saveInvoice = async (req, res) => {
  let uploadedFileId = null;

  try {
    if (!req.user?._id) {
      return res.status(401).json({
        success: false,
        message: "Please login first.",
      });
    }

    if (!req.file?.buffer) {
      return res.status(400).json({
        success: false,
        message: "Please upload an invoice PDF.",
      });
    }

    if (req.file.buffer.subarray(0, 5).toString() !== "%PDF-") {
      return res.status(400).json({
        success: false,
        message: "Invalid PDF file.",
      });
    }

    const {
      invoiceNumber,
      clientName,
      clientEmail,
      items,
      tax,
      discount,
    } = req.body;

    if (!invoiceNumber?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Invoice number is required.",
      });
    }

    if (!clientName?.trim() || !clientEmail?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Client name and email are required.",
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(clientEmail.trim())) {
      return res.status(400).json({
        success: false,
        message: "Invalid client email.",
      });
    }

    // Parse items
    let parsedItems;

    try {
      parsedItems = JSON.parse(items || "[]");
    } catch {
      return res.status(400).json({
        success: false,
        message: "Invalid invoice items.",
      });
    }

    if (!Array.isArray(parsedItems) || parsedItems.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Add at least one invoice item.",
      });
    }

    // Calculate subtotal
    let subtotal = 0;

    for (const item of parsedItems) {
      const qty = Number(item.qty);
      const price = Number(item.price);

      if (
        !Number.isFinite(qty) ||
        !Number.isFinite(price) ||
        qty <= 0 ||
        price < 0
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid item quantity or price.",
        });
      }

      subtotal += qty * price;
    }

    // Validate tax and discount
    const taxRate = Number(tax || 0);
    const discountAmount = Number(discount || 0);

    if (
      !Number.isFinite(taxRate) ||
      taxRate < 0 ||
      taxRate > 100
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid tax percentage.",
      });
    }

    if (
      !Number.isFinite(discountAmount) ||
      discountAmount < 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid discount.",
      });
    }

    const taxAmount = subtotal * (taxRate / 100);

    const totalAmount = Math.max(
      0,
      subtotal + taxAmount - discountAmount
    );

    // MongoDB connection
    const db = mongoose.connection.db;

    if (!db) {
      throw new Error("MongoDB connection unavailable.");
    }

    const bucket = new GridFSBucket(db, {
      bucketName: "invoices",
    });

    const safeInvoiceNumber = invoiceNumber.replace(
      /[^a-zA-Z0-9_-]/g,
      "_"
    );

    const fileName = `invoice-${safeInvoiceNumber}.pdf`;

    // Upload PDF to GridFS
    const uploadStream = bucket.openUploadStream(fileName, {
      contentType: "application/pdf",
      metadata: {
        userId: req.user._id,
        invoiceNumber,
      },
    });

    uploadedFileId = uploadStream.id;

    await new Promise((resolve, reject) => {
      uploadStream.on("finish", resolve);
      uploadStream.on("error", reject);

      Readable.from(req.file.buffer).pipe(uploadStream);
    });

    // Save invoice metadata
    const invoice = await Invoice.create({
      user: req.user._id,
      invoiceNumber: invoiceNumber.trim(),
      clientName: clientName.trim(),
      clientEmail: clientEmail.trim().toLowerCase(),
      items: parsedItems,
      tax: taxRate,
      discount: discountAmount,
      subtotal,
      taxAmount,
      totalAmount,
      pdfFileId: uploadedFileId,
      pdfFileName: fileName,
    });

    return res.status(201).json({
      success: true,
      message: "Invoice saved successfully.",
      invoice,
    });

  } catch (error) {
    console.error("Save invoice error:", error);

    if (uploadedFileId && mongoose.connection.db) {
      try {
        const bucket = new GridFSBucket(
          mongoose.connection.db,
          { bucketName: "invoices" }
        );

        await bucket.delete(uploadedFileId);
      } catch (deleteError) {
        console.error("GridFS cleanup:", deleteError.message);
      }
    }

    return res.status(500).json({
      success: false,
      message: "Failed to save invoice.",
      error: error.message,
    });
  }
};


// ========================================
// 2. GET MY INVOICES
// ========================================

const getMyInvoices = async (req, res) => {
  try {
    const invoices = await Invoice.find({
      user: req.user._id,
    }).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: invoices.length,
      invoices,
    });
  } catch (error) {
    console.error("Get invoices error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to fetch invoices.",
    });
  }
};

// ========================================
// 3. DOWNLOAD INVOICE (ID IN BODY)
// ========================================

const downloadInvoice = async (req, res) => {
  try {
    const { invoiceId } = req.body;

    if (!mongoose.Types.ObjectId.isValid(invoiceId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid invoice ID.",
      });
    }

    const invoice = await Invoice.findOne({
      _id: invoiceId,
      user: req.user._id,
    });

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: "Invoice not found.",
      });
    }

    const bucket = new GridFSBucket(
      mongoose.connection.db,
      { bucketName: "invoices" }
    );

    const files = await bucket.find({
      _id: invoice.pdfFileId,
    }).toArray();

    if (!files.length) {
      return res.status(404).json({
        success: false,
        message: "PDF not found in GridFS.",
      });
    }

    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition":
        `attachment; filename="${invoice.pdfFileName}"`,
    });

    const downloadStream = bucket.openDownloadStream(
      invoice.pdfFileId
    );

    downloadStream.on("error", (error) => {
      console.error("GridFS error:", error);

      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          message: "PDF download failed.",
        });
      } else {
        res.destroy(error);
      }
    });

    downloadStream.pipe(res);

  } catch (error) {
    console.error("Download error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to download invoice.",
    });
  }
};


// ========================================
// EXPORT
// ========================================

module.exports = {
  saveInvoice,
  getMyInvoices,
  downloadInvoice,
};
