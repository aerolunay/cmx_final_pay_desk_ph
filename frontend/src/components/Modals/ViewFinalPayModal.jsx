import React, { useState } from "react";
import ReactDOMServer from "react-dom/server";
import cmxLogo from "../../assets/cmxlogo-removebg-preview.png";
import PrintableFinalPay from "./PrintableFinalPay";
import { SERVER_URL } from "../lib/constants";
import UserService from "../../service/UserService";

// Util functions
const formatPhp = (val) => {
  const num = Number(val);

  if (Number.isNaN(num)) return "-";

  return `PHP ${num.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

const formatDiff = (val) => {
  const num = Number(val);

  if (Number.isNaN(num)) return "-";

  return num < 0 ? (
    <span className="text-red-600">({formatPhp(Math.abs(num))})</span>
  ) : (
    formatPhp(num)
  );
};

const formatTIN = (tin) => {
  if (!tin) return "-";

  const cleaned = String(tin).replace(/\D/g, "");

  if (!cleaned) return "-";

  if (cleaned.length === 9) {
    return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}-${cleaned.slice(
      6
    )}-000`;
  }

  return cleaned.replace(/(.{3})(.{3})(.{3})/, "$1-$2-$3");
};

const formatDate = (dateStr) => {
  if (!dateStr) return "—";

  const date = new Date(dateStr);

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleDateString("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
  });
};

const formatNum = (val) => {
  const num = Number(val);

  if (Number.isNaN(num)) return "-";

  return num.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const toNumber = (val) => {
  const num = Number(String(val ?? "").replace(/,/g, ""));
  return Number.isNaN(num) ? 0 : num;
};

const makeSafeFilename = (value, fallback = "Employee") => {
  const safe = String(value || fallback)
    .replace(/[\\/:*?"<>|,\r\n\t]/g, "_")
    .replace(/\s+/g, " ")
    .trim();

  return safe || fallback;
};

const handleDownloadExcel = async (
  empID,
  Name,
  setIsDownloading,
  setDownloadError
) => {
  try {
    setDownloadError("");
    setIsDownloading(true);

    if (!empID) {
      throw new Error("Missing employee ID.");
    }

    const response = await fetch(
      `${SERVER_URL}/api/finalpay/excel/${encodeURIComponent(empID)}`,
      {
        method: "GET",
        headers: {
          ...UserService.getAuthHeader(),
        },
      }
    );

    if (response.status === 401) {
      UserService.logout?.();
      window.location.href = "/OauthLogin";
      return;
    }

    if (response.status === 403) {
      throw new Error("You are not authorized to download this file.");
    }

    if (!response.ok) {
      throw new Error("Failed to download file.");
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);

    const safeName = makeSafeFilename(Name || empID);
    const link = document.createElement("a");

    link.href = url;
    link.setAttribute("download", `FinalPay_${safeName}.xlsx`);

    document.body.appendChild(link);
    link.click();

    link.parentNode.removeChild(link);
    window.URL.revokeObjectURL(url);
  } catch (error) {
    console.error("Download failed:", error);
    setDownloadError(error.message || "Failed to download the Excel file.");
  } finally {
    setIsDownloading(false);
  }
};

const ViewFinalPayModal = ({ selectedEmployee, onClose }) => {
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState("");

  if (!selectedEmployee) return null;

  const taxDiff =
    Number(selectedEmployee.tax_due || 0) -
    Number(selectedEmployee.total_withholding_tax_deductions || 0);

  const finalPay = Number(selectedEmployee.total_final_pay || 0);

  const grossFinalPay =
    Number(selectedEmployee.other_due_to_employee || 0) +
    Number(selectedEmployee.others || 0) +
    (taxDiff < 0 ? Math.abs(taxDiff) : 0);

  const handlePrintFinalPay = () => {
    const printableHtml = ReactDOMServer.renderToStaticMarkup(
      <PrintableFinalPay selectedEmployee={selectedEmployee} />
    );

    const printWindow = window.open("", "_blank", "width=900,height=1200");

    if (!printWindow) {
      alert("Please allow pop-ups to print the final pay document.");
      return;
    }

    printWindow.document.open();
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Final Pay Details</title>
            <style>
              @page {
                size: A4 portrait;
                margin: 0.25in;
              }

              html,
              body {
                margin: 0;
                padding: 0;
                background: white;
                color: black;
                font-family: monospace;
                font-size: 11px;
                line-height: 1.25;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }

              * {
                box-sizing: border-box;
              }

              .print-only {
                display: block !important;
                width: 100%;
                margin: 0;
                padding: 0;
                background: white;
              }

              .print-page {
                width: 100%;
                max-width: 7.75in;
                margin: 0 auto;
                padding: 0;
                background: white;
              }

              .bg-white { background: white; }
              .w-full { width: 100%; }
              .w-1\\/2 { width: 50%; }

              .flex { display: flex; }
              .grid { display: grid; }
              .justify-between { justify-content: space-between; }
              .items-end { align-items: flex-end; }
              .ml-auto { margin-left: auto; }

              .grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
              .grid-cols-6 { grid-template-columns: repeat(6, minmax(0, 1fr)); }
              .grid-cols-11 { grid-template-columns: repeat(11, minmax(0, 1fr)); }
              .grid-cols-12 { grid-template-columns: repeat(12, minmax(0, 1fr)); }

              .col-span-2 { grid-column: span 2 / span 2; }
              .col-span-4 { grid-column: span 4 / span 4; }
              .col-span-5 { grid-column: span 5 / span 5; }
              .col-span-6 { grid-column: span 6 / span 6; }

              .gap-1 { gap: 6px; }
              .gap-x-1 { column-gap: 6px; }

              .border {
                border: 1px solid black;
              }

              .border-black {
                border-color: black;
              }

              .p-1 {
                padding: 6px;
              }

              .py-1 {
                padding-top: 6px;
                padding-bottom: 6px;
              }

              .mb-1 {
                margin-bottom: 6px;
              }

              .mt-1 {
                margin-top: 6px;
              }

              .ml-3 { margin-left: 12px; }
              .ml-6 { margin-left: 22px; }
              .pl-6 { padding-left: 22px; }

              .text-left { text-align: left; }
              .text-right { text-align: right; }

              .font-medium { font-weight: 500; }
              .font-semibold { font-weight: 600; }
              .font-bold { font-weight: 700; }

              .text-gray-600 { color: #4b5563; }
              .text-gray-800 { color: #1f2937; }
              .text-gray-900 { color: #111827; }

              .text-red-600,
              .text-red-700,
              .text-red-800 {
                color: #b91c1c;
              }

              .text-\\[10px\\] { font-size: 11px; }
              .text-\\[12px\\] { font-size: 12px; }
              .text-\\[16px\\] { font-size: 18px; }

              .h-7 {
                height: 34px;
              }

              .w-auto {
                width: auto;
              }

              .object-contain {
                object-fit: contain;
              }

              img {
                max-height: 34px;
              }

              h4 {
                margin: 0 0 6px 0;
                font-size: 11px;
              }

              @media print {
                body {
                  margin: 0;
                }

                .print-page {
                  page-break-inside: avoid;
                }
              }
            </style>
        </head>

        <body>
          ${printableHtml}

          <script>
            window.onload = function () {
              window.focus();
              window.print();
              setTimeout(function () {
                window.close();
              }, 300);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50 no-print">
        <div
          className="bg-white rounded-lg shadow-xl w-full max-w-[1000px]
          px-6 py-4 relative border
          text-[13px] font-mono
          max-h-[85vh] flex flex-col"
        >
          <button
            type="button"
            className="absolute top-2 right-2 text-gray-500 hover:text-red-600 text-xl no-print"
            onClick={onClose}
          >
            &times;
          </button>

          <div className="overflow-y-auto pr-2 mt-2 scrollbar-thin scrollbar-thumb-gray-400">
            <div className="flex justify-between w-full py-2">
              <div>
                <span className="text-2xl font-semibold tracking-tight flex items-center gap-4">
                  Final Pay Details
                </span>

                <span className="mb-2 text-gray-600 text-md font-semibold">
                  Year:
                </span>{" "}
                {selectedEmployee.year}
              </div>

              <div className="flex flex-col items-end space-y-3 ml-auto">
                <img
                  src={cmxLogo}
                  alt="Callmax Logo"
                  className="h-8 w-auto object-contain"
                />

                <div className="flex flex-row gap-3 no-print">
                  <button
                    type="button"
                    disabled={isDownloading}
                    onClick={() =>
                      handleDownloadExcel(
                        selectedEmployee.empID,
                        selectedEmployee.Name,
                        setIsDownloading,
                        setDownloadError
                      )
                    }
                    className={`text-white text-sm px-4 py-1 rounded ${
                      isDownloading
                        ? "bg-blue-300 cursor-not-allowed"
                        : "bg-blue-600 hover:bg-blue-700"
                    }`}
                  >
                    {isDownloading ? "Generating..." : "Generate Data"}
                  </button>

                  <button
                    type="button"
                    onClick={handlePrintFinalPay}
                    className="bg-green-600 hover:bg-green-700 text-white text-sm px-4 py-1 rounded"
                  >
                    Print
                  </button>
                </div>

                {downloadError && (
                  <div className="text-xs text-red-600 max-w-[280px] text-right no-print">
                    {downloadError}
                  </div>
                )}
              </div>
            </div>

            <div className="text-gray-800 font-semibold">General Info:</div>

            <div className="grid grid-cols-11 gap-2 border border-black p-2 mb-2">
              <div className="col-span-5">
                <div className="grid grid-cols-2">
                  <div className="text-left font-medium text-gray-600">
                    Employee ID:
                  </div>
                  <div>{selectedEmployee.empID || "-"}</div>

                  <div className="text-left font-medium text-gray-600">
                    Employee Name:
                  </div>
                  <div>{selectedEmployee.Name || "-"}</div>

                  <div className="text-left font-medium text-gray-600">
                    Position:
                  </div>
                  <div>{selectedEmployee.position || "-"}</div>

                  <div className="text-left font-medium text-gray-600">
                    Hire Date:
                  </div>
                  <div>{formatDate(selectedEmployee.date_hired)}</div>

                  <div className="text-left font-medium text-gray-600">
                    Separation Date:
                  </div>
                  <div>{formatDate(selectedEmployee.date_resigned)}</div>

                  <div className="text-left font-medium text-gray-600">
                    Last Payout Cutoff:
                  </div>
                  <div>{formatDate(selectedEmployee.last_payout_cutoff)}</div>
                </div>
              </div>

              <div className="col-span-6">
                <div className="grid grid-cols-6">
                  <div className="text-left font-medium text-gray-600 col-span-2">
                    Tax Identification No:
                  </div>
                  <div className="col-span-4">
                    {formatTIN(selectedEmployee.tin)}
                  </div>

                  <div className="text-left font-medium text-gray-600 col-span-2">
                    Bank Account No:
                  </div>
                  <div className="col-span-4">
                    {selectedEmployee.bank_account_number || "-"}
                  </div>

                  <div className="text-left font-medium text-gray-600 col-span-2">
                    Contact No:
                  </div>
                  <div className="col-span-4">
                    {selectedEmployee.contact || "-"}
                  </div>

                  <div className="text-left font-medium text-gray-600 col-span-2">
                    Address:
                  </div>
                  <div className="col-span-4">
                    {selectedEmployee.address || "-"}
                  </div>
                </div>
              </div>
            </div>

            <div className="text-gray-800 font-semibold">
              Compensation Details:
            </div>

            <div className="grid grid-cols-12 gap-2 border border-black p-2 mb-2">
              <div className="col-span-6">
                <div className="grid grid-cols-2">
                  <div className="text-left font-medium text-gray-600">
                    Monthly Rate:
                  </div>
                  <div className="text-right mr-5">
                    {formatPhp(selectedEmployee.monthly_rate)}
                  </div>

                  <div className="text-left font-medium text-gray-600">
                    Daily Rate:
                  </div>
                  <div className="text-right mr-5">
                    {formatPhp(selectedEmployee.daily_rate)}
                  </div>

                  <div className="text-left font-medium text-gray-600">
                    Night Diff %:
                  </div>
                  <div className="text-right mr-5">
                    {selectedEmployee.ndiff_pct != null
                      ? `${formatNum(selectedEmployee.ndiff_pct)} %`
                      : "-"}
                  </div>

                  <div className="text-left font-medium text-gray-600">
                    Skills Allowance:
                  </div>
                  <div className="text-right mr-5">
                    {formatPhp(selectedEmployee.skills_allowance)}
                  </div>
                </div>
              </div>

              <div className="col-span-6">
                <div className="grid grid-cols-2">
                  <div className="text-left font-medium text-gray-600 ml-2">
                    Work Days to Pay:
                  </div>
                  <div className="text-right mr-5">
                    {formatNum(selectedEmployee.unpaid_work_days)}
                  </div>

                  <div className="text-left font-medium text-gray-600 ml-2">
                    SL/VL Days to Pay:
                  </div>
                  <div className="text-right mr-5">
                    {formatNum(selectedEmployee.unpaid_slvl_days)}
                  </div>

                  <div className="text-left font-medium text-gray-600 ml-2">
                    Reg Holidays to Pay:
                  </div>
                  <div className="text-right mr-5">
                    {formatNum(selectedEmployee.holiday_days)}
                  </div>

                  <div className="text-left font-medium text-gray-600 ml-2">
                    Remaining SL Days (conversion):
                  </div>
                  <div className="text-right mr-5">
                    {formatNum(selectedEmployee.sl_remaining_days)}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-2 mb-2">
              <div className="w-1/2 border border-black p-2">
                <h4 className="font-bold mb-1">Final Pay Breakdown:</h4>

                <div className="mb-2 font-semibold">Wages:</div>

                <div className="flex justify-between">
                  <span className="ml-5">Remaining Basic Pay:</span>
                  <span className="mr-2">
                    {formatPhp(selectedEmployee.remaining_basic_pay)}
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="ml-5">Remaining NDiff Pay:</span>
                  <span className="mr-2">
                    {formatPhp(selectedEmployee.ndiff_amount)}
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="ml-5">Remaining Holiday Pay:</span>
                  <span className="mr-2">
                    {formatPhp(selectedEmployee.holiday_pay_amount)}
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="ml-5">Remaining SL/VL:</span>
                  <span className="mr-2">
                    {formatPhp(selectedEmployee.remaining_vl_pay)}
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="ml-5">Remaining Skills Allowance:</span>
                  <span className="mr-2">
                    {formatPhp(selectedEmployee.skills_allowance_amount)}
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="ml-5">13th Month Pay:</span>
                  <span className="mr-2">
                    {formatPhp(selectedEmployee.thirteenth_month_total)}
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="ml-5">SL Conversion:</span>
                  <span className="mr-2">
                    {formatPhp(selectedEmployee.sl_remaining)}
                  </span>
                </div>

                <div className="mt-3 font-semibold mb-1">Adjustments:</div>

                <div className="flex justify-between">
                  <span className="ml-5">Adjustment Amount:</span>
                  <span className="mr-2">
                    {formatPhp(selectedEmployee.adjustment_amount)}
                  </span>
                </div>

                <div className="flex justify-between mt-3">
                  <span className="font-semibold">Gross Remaining Pay:</span>
                  <span className="font-bold mr-2">
                    {formatPhp(selectedEmployee.other_due_to_employee)}
                  </span>
                </div>
              </div>

              <div className="w-1/2 border border-black p-2">
                <h4 className="font-bold mb-1">Tax Calculation:</h4>

                <div className="flex justify-between">
                  <span className="font-semibold ml-5">
                    YTD Gross Compensation:
                  </span>
                  <span className="mr-2">
                    {formatPhp(selectedEmployee.ytd_gross_compensation)}
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="ml-5 mt-3 font-semibold">Less:</span>
                </div>

                <div className="flex justify-between">
                  <span className="ml-10">13th Month Pay:</span>
                  <span className="mr-2">
                    {formatDiff(selectedEmployee.thirteenth_month_capped)}
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="ml-10">SSS / PHIC / HDMF:</span>
                  <span className="mr-2">
                    {formatDiff(selectedEmployee.sss_phic_hdmf)}
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="ml-10">Skills Allowance:</span>
                  <span className="mr-2">
                    {formatDiff(toNumber(selectedEmployee.total_skills_allowance))}
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="ml-10">Consumed SL/VL:</span>
                  <span className="mr-2">
                    {formatDiff(toNumber(selectedEmployee.remaining_vl_pay))}
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="ml-10">Other Non-Tax Compensation:</span>
                  <span className="mr-2">
                    {formatDiff(toNumber(selectedEmployee.other_non_tax_compensation))}
                  </span>
                </div>

                <div className="flex justify-between mt-3">
                  <span className="font-semibold ml-5">
                    Net Taxable Income:
                  </span>
                  <span className="mr-2">
                    {formatPhp(selectedEmployee.net_taxable_income)}
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="font-semibold ml-5">Total Tax Due:</span>
                  <span className="mr-2">
                    {formatPhp(selectedEmployee.tax_due)}
                  </span>
                </div>

                <div className="flex justify-between mt-3">
                  <span className="font-semibold ml-5">
                    Total Withholding Tax Deductions:
                  </span>
                  <span className="mr-2">
                    {formatPhp(selectedEmployee.total_withholding_tax_deductions)}
                  </span>
                </div>

                <div className="flex justify-between mt-3">
                  <span className="font-semibold ml-5">
                    {taxDiff > 0 ? "Remaining Tax Due:" : "Tax Refund:"}
                  </span>

                  <span className={`mr-2 ${taxDiff > 0 ? "text-red-600" : ""}`}>
                    {taxDiff > 0
                      ? `(${formatPhp(taxDiff)})`
                      : formatPhp(Math.abs(taxDiff))}
                  </span>
                </div>
              </div>
            </div>

            <div className="border border-black p-2">
              <h4 className="font-bold mb-1">Final Pay Summary:</h4>

              <div className="grid grid-cols-5 gap-1">
                <div className="col-span-3 font-semibold">
                  Gross Remaining Pay:
                </div>
                <div className="col-span-2 text-right font-semibold">
                  {formatPhp(selectedEmployee.other_due_to_employee)}
                </div>

                <div className="col-span-3 font-semibold mt-3">
                  Add: Other Adjustments (Contribution Returns, etc.):
                </div>
                <div className="col-span-2 text-right mt-3 font-semibold">
                  {formatPhp(selectedEmployee.others)}
                </div>

                {taxDiff <= 0 && (
                  <>
                    <div className="col-span-3 font-semibold pl-9">
                      Tax Refund:
                    </div>
                    <div className="col-span-2 text-right font-semibold">
                      {formatPhp(Math.abs(taxDiff))}
                    </div>
                  </>
                )}

                <div className="col-span-3 font-bold mt-3">
                  Gross Final Pay:
                </div>
                <div className="col-span-2 text-right font-bold">
                  {formatPhp(grossFinalPay)}
                </div>

                <div className="col-span-3 font-semibold text-red-700 mt-3">
                  Less: Partial 13th Month Pay:
                </div>
                <div className="col-span-2 text-right font-semibold text-red-700 mt-3">
                  {formatPhp(selectedEmployee.thirteenth_month_partial)}
                </div>

                {taxDiff > 0 && (
                  <>
                    <div className="col-span-3 font-semibold pl-11 text-red-700">
                      Tax Due:
                    </div>
                    <div className="col-span-2 text-right font-semibold text-red-700">
                      ({formatPhp(taxDiff)})
                    </div>
                  </>
                )}

                <div className="col-span-3 pl-11 font-semibold text-red-700">
                  Outstanding Company Loans:
                </div>
                <div className="col-span-2 text-right font-semibold text-red-700">
                  {formatPhp(selectedEmployee.outstanding_company_loans)}
                </div>

                <div className="col-span-3 pl-11 font-semibold text-red-700">
                  Other Accountabilities:
                </div>
                <div className="col-span-2 text-right font-semibold text-red-800">
                  {formatPhp(selectedEmployee.other_accountabilities)}
                </div>

                <div className="col-span-3 font-bold text-gray-900 mt-5">
                  Net Final Pay:
                </div>
                <div className="col-span-2 text-right font-bold text-[15px] mt-3">
                  {formatPhp(finalPay)}
                </div>
              </div>
            </div>
          </div>
        </div>

        {isDownloading && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 no-print">
            <div className="bg-white px-6 py-4 rounded-lg shadow-lg flex items-center gap-3">
              <svg
                className="animate-spin h-6 w-6 text-blue-600"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />

                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8v8z"
                />
              </svg>

              <span className="text-gray-700 font-medium">
                Generating Final Pay Documents...
              </span>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default ViewFinalPayModal;