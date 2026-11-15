
const mongoose = require("mongoose");

const invoiceSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    invoiceNumber: {
      type: String,
      required: true,
      trim: true,
    },

    clientName: {
      type: String,
      required: true,
      trim: true,
    },

    clientEmail: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },

    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },

    pdfFileId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },

    pdfFileName: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Invoice", invoiceSchema);
