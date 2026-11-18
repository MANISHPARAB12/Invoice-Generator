import { useRef, useState } from "react";
import html2canvas from "html2canvas-pro";
import { jsPDF } from "jspdf";

import { templates } from "../Data/templates";
import invoiceServices from "../Services/invoiceServices";

import "../App.css";

export default function InvoicePreview({
  invoice,
  template = "modern",
}) {
  const invoiceRef = useRef(null);
  const [downloading, setDownloading] = useState(false);

  const selectedTemplate = templates.find(
    (item) => item.id === template
  );

  const SelectedTemplate = selectedTemplate?.Component;

  const handleDownload = async () => {
    if (!invoiceRef.current || downloading) return;

    // Validate invoice data before generating PDF
    const clientName = invoice?.client?.name?.trim() || "";
    const clientEmail = invoice?.client?.email?.trim() || "";
    const items = invoice?.items || [];

    if (!invoice?.invoiceNumber?.trim()) {
      alert("Please enter an invoice number.");
      return;
    }

    if (!clientName || !clientEmail) {
      alert("Please enter the client's name and email.");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clientEmail)) {
      alert("Please enter a valid client email.");
      return;
    }

    if (!items.length) {
      alert("Please add at least one invoice item.");
      return;
    }

    const invalidItem = items.some(
      (item) =>
        !item.name?.trim() ||
        !Number.isFinite(Number(item.qty)) ||
        Number(item.qty) <= 0 ||
        !Number.isFinite(Number(item.price)) ||
        Number(item.price) < 0
    );

    if (invalidItem) {
      alert("Please check your invoice items.");
      return;
    }

    setDownloading(true);

    try {
      const element = invoiceRef.current;

      // Wait for images
      const images = [...element.querySelectorAll("img")];

      await Promise.all(
        images.map((img) => {
          if (img.complete) return Promise.resolve();

          return new Promise((resolve) => {
            img.onload = resolve;
            img.onerror = resolve;
          });
        })
      );

      // Wait for fonts
      if (document.fonts?.ready) {
        await document.fonts.ready;
      }

      // Generate canvas
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        allowTaint: false,
        backgroundColor: "#ffffff",
        logging: false,
        windowWidth: element.scrollWidth,
      });

      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      const margin = 8;
      const pageWidth = 210;
      const pageHeight = 297;

      const contentWidth = pageWidth - margin * 2;
      const contentHeight = pageHeight - margin * 2;

      const pageCanvasHeight =
        (canvas.width * contentHeight) / contentWidth;

      let position = 0;
      let page = 0;

      // Generate multiple PDF pages
      while (position < canvas.height) {
        const sliceHeight = Math.min(
          pageCanvasHeight,
          canvas.height - position
        );

        const pageCanvas = document.createElement("canvas");

        pageCanvas.width = canvas.width;
        pageCanvas.height = sliceHeight;

        const context = pageCanvas.getContext("2d");

        if (!context) {
          throw new Error("Unable to generate PDF canvas.");
        }

        context.drawImage(
          canvas,
          0,
          position,
          canvas.width,
          sliceHeight,
          0,
          0,
          canvas.width,
          sliceHeight
        );

        const imageData = pageCanvas.toDataURL(
          "image/jpeg",
          0.98
        );

        if (page > 0) {
          pdf.addPage();
        }

        const currentHeight =
          (sliceHeight * contentWidth) / canvas.width;

        pdf.addImage(
          imageData,
          "JPEG",
          margin,
          margin,
          contentWidth,
          currentHeight
        );

        position += sliceHeight;
        page++;
      }

      // Generate filename
      const fileName = String(
        invoice.invoiceNumber
      ).replace(/[^a-zA-Z0-9_-]/g, "_");

      // Convert PDF to Blob
      const pdfBlob = pdf.output("blob");

      // Prepare FormData
      const formData = new FormData();

      formData.append(
        "pdf",
        pdfBlob,
        `invoice-${fileName}.pdf`
      );

      formData.append("invoiceNumber", invoice.invoiceNumber.trim());
      formData.append("clientName", clientName);
      formData.append("clientEmail", clientEmail);

      formData.append("items", JSON.stringify(items));

      formData.append(
        "tax",
        String(Number(invoice?.tax) || 0)
      );

      formData.append(
        "discount",
        String(Number(invoice?.discount) || 0)
      );

      // Debug data
      console.log("Invoice data being saved:", {
        invoiceNumber: invoice.invoiceNumber,
        clientName,
        clientEmail,
        items,
        tax: invoice.tax,
        discount: invoice.discount,
      });

      // Save invoice in MongoDB
      const result = await invoiceServices.saveInvoice(formData);

      if (!result.success) {
        throw new Error(
          result.message || "Invoice could not be saved."
        );
      }

      console.log("Saved invoice:", result.invoice);

      // Download only after successful save
      const url = URL.createObjectURL(pdfBlob);
      const link = document.createElement("a");

      link.href = url;
      link.download = `invoice-${fileName}.pdf`;

      document.body.appendChild(link);
      link.click();
      link.remove();

      setTimeout(() => {
        URL.revokeObjectURL(url);
      }, 1000);

      alert("Invoice saved and downloaded successfully!");

    } catch (error) {
      console.error("Invoice save/download failed:", error);

      alert(
        error.response?.data?.message ||
        error.message ||
        "Unable to save invoice."
      );

    } finally {
      setDownloading(false);
    }
  };

  return (
    <section className="invoice-preview-container min-w-0 w-full">

      <div className="invoice-preview-toolbar">
        <div>
          <h2>Invoice Preview</h2>

          <p>
            Template: {selectedTemplate?.name || template}
          </p>
        </div>

        <button
          type="button"
          onClick={handleDownload}
          disabled={downloading || !SelectedTemplate}
          className="invoice-download-btn"
        >
          {downloading
            ? "Saving Invoice..."
            : "Save & Download PDF"}
        </button>
      </div>

      <div className="invoice-preview-canvas">
        {SelectedTemplate ? (
          <div
            ref={invoiceRef}
            className="invoice-document"
          >
            <SelectedTemplate invoice={invoice} />
          </div>
        ) : (
          <div className="p-6 text-center text-red-600">
            <p>Template not found.</p>
          </div>
        )}
      </div>

    </section>
  );
}
