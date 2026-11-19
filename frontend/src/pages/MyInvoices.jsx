
import { useEffect, useState, useCallback } from "react";
import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { Download, FileText, LoaderCircle } from "lucide-react";

import invoiceServices from "../Services/invoiceServices";

export default function MyInvoices() {
  const navigate = useNavigate();

  const { isAuth, authInitialized } = useSelector(
    (state) => state.user
  );

  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [downloadingId, setDownloadingId] = useState(null);

  // Fetch invoices
  const fetchInvoices = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const result = await invoiceServices.getMyInvoices();

      if (!result.success) {
        throw new Error(
          result.message || "Unable to fetch invoices."
        );
      }

      setInvoices(result.invoices || []);
    } catch (err) {
      console.error("Fetch invoices error:", err);

      if (err.response?.status === 401) {
        setError("Your session has expired. Please login again.");
        return;
      }

      setError(
        err.response?.data?.message ||
        err.message ||
        "Unable to load invoices."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  // Wait until authentication is initialized
  useEffect(() => {
    if (!authInitialized) return;

    if (!isAuth) {
      setLoading(false);
      setError("Please login first.");
      return;
    }

    fetchInvoices();
  }, [authInitialized, isAuth, fetchInvoices]);

  // Download invoice
  const handleDownload = async (invoice) => {
    try {
      setDownloadingId(invoice._id);

      const blob = await invoiceServices.downloadInvoice(
        invoice._id
      );

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = url;
      link.download = invoice.pdfFileName || "invoice.pdf";

      document.body.appendChild(link);
      link.click();
      link.remove();

      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Download error:", err);

      if (err.response?.status === 401) {
        alert("Your session has expired. Please login again.");
        navigate("/login");
        return;
      }

      alert(
        err.response?.data?.message ||
        "Unable to download invoice."
      );
    } finally {
      setDownloadingId(null);
    }
  };

  // Wait for authentication check
  if (!authInitialized || loading) {
    return (
      <div className="flex min-h-[300px] items-center justify-center gap-2">
        <LoaderCircle className="animate-spin" />
        <span>Loading invoices...</span>
      </div>
    );
  }

  // Authentication error
  if (!isAuth || error === "Please login first.") {
    return (
      <div className="p-6 text-center">
        <p className="text-red-600">Please login first.</p>

        <button
          onClick={() => navigate("/login")}
          className="mt-3 rounded-lg bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700"
        >
          Login
        </button>
      </div>
    );
  }

  // Other errors
  if (error) {
    return (
      <div className="p-6 text-center">
        <p className="text-red-600">{error}</p>

        <button
          onClick={fetchInvoices}
          className="mt-3 rounded-lg bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700"
        >
          Try Again
        </button>
      </div>
    );
  }

  const totalAmount = invoices.reduce(
    (sum, invoice) => sum + Number(invoice.totalAmount || 0),
    0
  );

  return (
    <section className="w-full min-w-0 p-4 md:p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          My Invoices
        </h1>

        <p className="mt-1 text-sm text-gray-500">
          View and download your saved invoices.
        </p>
      </div>

      {/* Invoice statistics */}
      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-xl border bg-white p-5">
          <p className="text-sm text-gray-500">
            Total Invoices
          </p>

          <h2 className="mt-2 text-2xl font-bold">
            {invoices.length}
          </h2>
        </div>

        <div className="rounded-xl border bg-white p-5">
          <p className="text-sm text-gray-500">
            Total Invoice Value
          </p>

          <h2 className="mt-2 text-2xl font-bold">
            {totalAmount.toLocaleString("en-IN", {
              style: "currency",
              currency: "INR",
            })}
          </h2>
        </div>
      </div>

      {/* Invoice table */}
      <div className="overflow-x-auto rounded-xl border bg-white">
        {invoices.length === 0 ? (
          <div className="p-10 text-center">
            <FileText
              size={42}
              className="mx-auto mb-3 text-gray-400"
            />

            <h3 className="font-semibold text-gray-800">
              No invoices found
            </h3>

            <p className="mt-1 text-sm text-gray-500">
              Your saved invoices will appear here.
            </p>
          </div>
        ) : (
          <table className="w-full min-w-[750px] text-left text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="p-4">Invoice Number</th>
                <th className="p-4">Client</th>
                <th className="p-4">Email</th>
                <th className="p-4">Amount</th>
                <th className="p-4">Created Date</th>
                <th className="p-4">Action</th>
              </tr>
            </thead>

            <tbody className="divide-y">
              {invoices.map((invoice) => (
                <tr
                  key={invoice._id}
                  className="hover:bg-gray-50"
                >
                  <td className="p-4 font-semibold">
                    {invoice.invoiceNumber}
                  </td>

                  <td className="p-4">
                    {invoice.clientName}
                  </td>

                  <td className="p-4">
                    {invoice.clientEmail}
                  </td>

                  <td className="p-4 font-medium">
                    {Number(invoice.totalAmount || 0).toLocaleString(
                      "en-IN",
                      {
                        style: "currency",
                        currency: "INR",
                      }
                    )}
                  </td>

                  <td className="p-4">
                    {invoice.createdAt
                      ? new Date(invoice.createdAt).toLocaleDateString(
                          "en-IN"
                        )
                      : "-"}
                  </td>

                  <td className="p-4">
                    <button
                      onClick={() => handleDownload(invoice)}
                      disabled={downloadingId === invoice._id}
                      className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-white hover:bg-indigo-700 disabled:opacity-50"
                    >
                      {downloadingId === invoice._id ? (
                        <LoaderCircle
                          size={16}
                          className="animate-spin"
                        />
                      ) : (
                        <Download size={16} />
                      )}

                      Download
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
