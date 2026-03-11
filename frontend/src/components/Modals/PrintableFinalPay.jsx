import React, { useState } from "react";
import cmxLogo from "../../assets/cmxlogo-removebg-preview.png"
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { SERVER_URL } from "../lib/constants";

// Util functions
const formatPhp = (val) => {
  const num = Number(val);
  if (isNaN(num)) return "-";
  return `PHP ${num.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

const formatDiff = (val) => {
  const num = Number(val);
  if (isNaN(num)) return "-";
  return num < 0
    ? <span className="text-red-600">({formatPhp(Math.abs(num))})</span>
    : formatPhp(num);
};

const formatTIN = (tin) => {
  if (!tin) return "-";
  const cleaned = tin.replace(/\D/g, "");
  const formatted = cleaned.length === 9
    ? `${cleaned.slice(0,3)}-${cleaned.slice(3,6)}-${cleaned.slice(6)}-000`
    : cleaned.replace(/(.{3})(.{3})(.{3})/, "$1-$2-$3");
  return formatted;
};

const formatDate = (dateStr) => {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
  });
};

const formatNum = (val) => {
  const num = Number(val);
  if (isNaN(num)) return "-";
  return num.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const toNumber = (val) => {
  const num = Number(String(val).replace(/,/g, ""));
  return isNaN(num) ? 0 : num;
};

const handleDownloadExcel = async (empID, Name, setIsDownloading) => {
  try {
    setIsDownloading(true);

    const response = await fetch(`${SERVER_URL}/api/finalpay/excel/${empID}`, {
      method: "GET",
    });

    if (!response.ok) {
      throw new Error("Failed to download file");
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(new Blob([blob]));

    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `FinalPay_${Name}.xlsx`);
    document.body.appendChild(link);
    link.click();

    link.parentNode.removeChild(link);
    window.URL.revokeObjectURL(url);
  } catch (error) {
    console.error("❌ Download failed:", error);
    alert("Failed to download the Excel file.");
  } finally {
    setIsDownloading(false);
  }
};

// The Modal
const PrintableFinalPay = ({ selectedEmployee}) => {
  const [isDownloading, setIsDownloading] = useState(false);

  if (!selectedEmployee) return null;
  // Derived values
  const taxDiff = Number(selectedEmployee.tax_due || 0) -
                  Number(selectedEmployee.total_withholding_tax_deductions || 0);
  const finalPay = Number(selectedEmployee.total_final_pay || 0);
  const remainingPay = Number(selectedEmployee.other_due_to_employee) + Number(selectedEmployee.thirteenth_month_partial)
  const wageDeductibles = Number(selectedEmployee.other_accountabilities) + Number(selectedEmployee.outstanding_company_loans)
  const overallRemainingPay = remainingPay - wageDeductibles

  const grossFinalPay =
  Number(selectedEmployee.other_due_to_employee || 0) +
  Number(selectedEmployee.others || 0) +
  (taxDiff < 0 ? Math.abs(taxDiff) : 0);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
      <div className="print-only px-10 py-8 text-[13px] font-mono bg-white w-full">
          <div className="mt-2">
            {/* Title */}
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
              </div>
            </div>

            {/* General Info */}
            <div className="text-gray-800 font-semibold">General Info:</div>
            <div className="grid grid-cols-11 gap-2 border border-black p-2 mb-2">
              <div className="col-span-5">
                <div className="grid grid-cols-2">
                  <div className="text-left font-medium text-gray-600">Employee ID:</div>
                  <div>{selectedEmployee.empID || "-"}</div>
                  <div className="text-left font-medium text-gray-600">Employee Name:</div>
                  <div>{selectedEmployee.Name || "-"}</div>
                  <div className="text-left font-medium text-gray-600">Position:</div>
                  <div>{selectedEmployee.position || "-"}</div>
                  <div className="text-left font-medium text-gray-600">Hire Date:</div>
                  <div>{formatDate(selectedEmployee.date_hired)}</div>
                  <div className="text-left font-medium text-gray-600">Separation Date:</div>
                  <div>{formatDate(selectedEmployee.date_resigned)}</div>
                  <div className="text-left font-medium text-gray-600">Last Payout Cutoff:</div>
                  <div>{formatDate(selectedEmployee.last_payout_cutoff) || "-"}</div>
                </div>
              </div>
              {/* <div className="col-span-1"></div> */}
              <div className="col-span-6">
                <div className="grid grid-cols-6">
                  <div className="text-left font-medium text-gray-600 col-span-2">Tax Identification No:</div>
                  <div className="col-span-4">{formatTIN(selectedEmployee.tin) || "-"}</div>
                  <div className="text-left font-medium text-gray-600 col-span-2">Bank Account No:</div>
                  <div className="col-span-4">{selectedEmployee.bank_account_number || "-"}</div>
                  <div className="text-left font-medium text-gray-600 col-span-2">Contact No:</div>
                  <div className="col-span-4">{selectedEmployee.contact || "-"}</div>
                  <div className="text-left font-medium text-gray-600 col-span-2">Address:</div>
                  <div className="col-span-4">{selectedEmployee.address || "-"}</div>
                </div>
              </div>
            </div>

            {/* Compensation Summary */}
            <div className="text-gray-800 font-semibold">Compensation Details:</div>
            <div className="grid grid-cols-12 gap-2 border border-black p-2 mb-2">
              <div className="col-span-6">
                <div className="grid grid-cols-2">
                  <div className="text-left font-medium text-gray-600">Monthly Rate:</div>
                  <div className="text-right mr-5">{formatPhp(selectedEmployee.monthly_rate)}</div>
                  <div className="text-left font-medium text-gray-600">Daily Rate:</div>
                  <div className="text-right mr-5">{formatPhp(selectedEmployee.daily_rate)}</div>
                  <div className="text-left font-medium text-gray-600">Night Diff %:</div>
                  <div className="text-right mr-5">
                    {selectedEmployee.ndiff_pct != null
                      ? `${formatNum(selectedEmployee.ndiff_pct)} %`
                      : "-"}
                  </div>
                  <div className="text-left font-medium text-gray-600">Skills Allowance:</div>
                  <div className="text-right mr-5">{formatPhp(selectedEmployee.skills_allowance)}</div>
                </div>
              </div>
              {/* <div className="col-span-1"></div> */}
              <div className="col-span-6">
                <div className="grid grid-cols-2">
                  <div className="text-left font-medium text-gray-600 ml-2">Work Days to Pay:</div>
                  <div className="text-right mr-5">{formatNum(selectedEmployee.unpaid_work_days)}</div>
                  <div className="text-left font-medium text-gray-600 ml-2">SL/VL Days to Pay:</div>
                  <div className="text-right mr-5">{formatNum(selectedEmployee.unpaid_slvl_days)}</div>
                  <div className="text-left font-medium text-gray-600 ml-2">Reg Holidays to Pay:</div>
                  <div className="text-right mr-5">{formatNum(selectedEmployee.holiday_days)}</div>
                  <div className="text-left font-medium text-gray-600 ml-2">Remaining SL Days (conversion):</div>
                  <div className="text-right mr-5">{formatNum(selectedEmployee.sl_remaining_days)}</div>
                </div>
              </div>
            </div>

            {/* Breakdown and Tax */}
            <div className="flex gap-2 mb-2">
              {/* Final Pay Breakdown */}
              <div className="w-1/2 border border-black p-2">
                <h4 className="font-bold mb-1">Final Pay Breakdown:</h4>
                <div className="mb-2 font-semibold">Wages:</div>
                <div className="flex justify-between"><span className="ml-5">Remaining Basic Pay:</span><span className="mr-2">{formatPhp(selectedEmployee.remaining_basic_pay)}</span></div>
                <div className="flex justify-between"><span className="ml-5">Remaining NDiff Pay:</span><span className="mr-2">{formatPhp(selectedEmployee.ndiff_amount)}</span></div>
                <div className="flex justify-between"><span className="ml-5">Remaining Holiday Pay:</span><span className="mr-2">{formatPhp(selectedEmployee.holiday_pay_amount)}</span></div>
                <div className="flex justify-between"><span className="ml-5">Remaining SL/VL:</span><span className="mr-2">{formatPhp(selectedEmployee.remaining_vl_pay)}</span></div>
                <div className="flex justify-between"><span className="ml-5">Remaining Skills Allowance:</span><span className="mr-2">{formatPhp(selectedEmployee.skills_allowance_amount)}</span></div>
                <div className="flex justify-between"><span className="ml-5">13th Month Pay:</span><span className="mr-2">{formatPhp(selectedEmployee.thirteenth_month_total)}</span></div>
                <div className="flex justify-between"><span className="ml-5">SL Conversion:</span><span className="mr-2">{formatPhp(selectedEmployee.sl_remaining)}</span></div>            
                <div className="mt-3 font-semibold mb-1">Adjustments:</div>
                <div className="flex justify-between"><span className="ml-5">Adjustment Amount:</span><span className="mr-2">{formatPhp(selectedEmployee.adjustment_amount)}</span></div>
                <div className="flex justify-between mt-3 "><span className="font-semibold"> Gross Remaining Pay:</span><span className="font-bold mr-2">{formatPhp(selectedEmployee.other_due_to_employee)}</span></div>
              </div>

              {/* Tax Calculation */}
              <div className="w-1/2 border border-black p-2">
                <h4 className="font-bold mb-1">Tax Calculation:</h4>
                <div className="flex justify-between"><span className="font-semibold ml-5">YTD Gross Compensation:</span><span className="mr-2">{formatPhp(selectedEmployee.ytd_gross_compensation)}</span></div>
                <div className="flex justify-between"><span className="ml-5 mt-3 font-semibold">Less:</span></div>
                <div className="flex justify-between"><span className="ml-10">13th Month Pay:</span><span className="mr-2">{formatDiff(selectedEmployee.thirteenth_month_capped)}</span></div>
                <div className="flex justify-between"><span className="ml-10">SSS / PHIC / HDMF:</span><span className="mr-2">{formatDiff(selectedEmployee.sss_phic_hdmf)}</span></div>
                <div className="flex justify-between"><span className="ml-10">Skills Allowance:</span><span className="mr-2">{formatDiff(toNumber(selectedEmployee.total_skills_allowance))}</span></div>
                <div className="flex justify-between"><span className="ml-10">Consumed SL/VL:</span><span className="mr-2">{formatDiff(toNumber(selectedEmployee.remaining_vl_pay))}</span></div>                
                <div className="flex justify-between"><span className="ml-10">Other Non-Tax Compensation:</span><span className="mr-2">{formatDiff(toNumber(selectedEmployee.other_non_tax_compensation))}</span></div>
                <div className="flex justify-between mt-3"><span className="font-semibold ml-5">Net Taxable Income:</span><span className="mr-2">{formatPhp(selectedEmployee.net_taxable_income)}</span></div>
                <div className="flex justify-between"><span className="font-semibold ml-5">Total Tax Due:</span><span className="mr-2">{formatPhp(selectedEmployee.tax_due)}</span></div>
                <div className="flex justify-between mt-3"><span className="font-semibold ml-5">Total Withholding Tax Deductions:</span><span className="mr-2">{formatPhp(selectedEmployee.total_withholding_tax_deductions)}</span></div>

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

            {/* Final Summary */}
            <div className="border border-black p-2">
              <h4 className="font-bold mb-1">Final Pay Summary:</h4>
              <div className="grid grid-cols-6 gap-1">
                <div className="col-span-4 font-semibold">Gross Remaining Pay:</div>
                <div className="col-span-2 text-right font-semibold">{formatPhp(selectedEmployee.other_due_to_employee)}</div>
                <div className="col-span-4 font-semibold mt-3">Add: Other Adjustments (Contribution Returns, etc.):</div>
                <div className="col-span-2 text-right mt-3 font-semibold">{formatPhp(selectedEmployee.others)}</div>
                {taxDiff <= 0 && (
                  <>
                    <div className="col-span-4 font-semibold pl-9">
                      Tax Refund:
                    </div>
                    <div className="col-span-2 text-right font-semibold">
                      {formatPhp(Math.abs(taxDiff))}
                    </div>
                  </>
                )}

                <div className="col-span-4 font-bold mt-3">Gross Final Pay:</div>
                <div className="col-span-2 text-right font-bold">{formatPhp(grossFinalPay)}</div>
            
                <div className="col-span-4 font-semibold text-red-700 mt-3">Less: Partial 13th Month Pay:</div>
                <div className="col-span-2 text-right font-semibold text-red-700 mt-3">{formatPhp(selectedEmployee.thirteenth_month_partial)}</div>
                {taxDiff > 0 && (
                  <>
                    <div className="col-span-4 font-semibold pl-11 text-red-700">
                      Tax Due:
                    </div>
                    <div className="col-span-2 text-right font-semibold text-red-700">
                      ({formatPhp(taxDiff)})
                    </div>
                  </>
                )}
                <div className="col-span-4 pl-11 font-semibold text-red-700">Outstanding Company Loans:</div>
                <div className="col-span-2 text-right font-semibold text-red-700">{formatPhp(selectedEmployee.outstanding_company_loans)}</div>
                <div className="col-span-4 pl-11 font-semibold text-red-700">Other Accountabilities:</div>
                <div className="col-span-2 text-right font-semibold text-red-800">{formatPhp(selectedEmployee.other_accountabilities)}</div>

                <div className="col-span-4 font-bold text-gray-900 mt-5">Net Final Pay:</div>
                <div className="col-span-2 text-right font-bold text-[15px] mt-3">
                  {formatPhp(finalPay)}
                </div>
              </div>
            </div>
          </div>
      </div>
    </div>
  );
};

export default PrintableFinalPay;


