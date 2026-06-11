import React from "react";
import cmxLogo from "../../assets/cmxlogo-removebg-preview.png";

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

const PrintableFinalPay = ({ selectedEmployee }) => {
  if (!selectedEmployee) return null;

  const taxDiff =
    Number(selectedEmployee.tax_due || 0) -
    Number(selectedEmployee.total_withholding_tax_deductions || 0);

  const finalPay = Number(selectedEmployee.total_final_pay || 0);

  const grossFinalPay =
    Number(selectedEmployee.other_due_to_employee || 0) +
    Number(selectedEmployee.others || 0) +
    (taxDiff < 0 ? Math.abs(taxDiff) : 0);

  return (
    <div className="print-only">
      <div className="print-page text-[10px] font-mono bg-white w-full">
        <div className="flex justify-between w-full py-1">
          <div>
            <div className="text-[16px] font-semibold tracking-tight">
              Final Pay Details
            </div>

            <div className="text-gray-600 font-semibold">
              Year: {selectedEmployee.year || "—"}
            </div>
          </div>

          <div className="flex flex-col items-end ml-auto">
            <img
              src={cmxLogo}
              alt="Callmax Logo"
              className="h-7 w-auto object-contain"
            />
          </div>
        </div>

        <div className="text-gray-800 font-semibold">General Info:</div>

        <div className="grid grid-cols-11 gap-1 border border-black p-1 mb-1">
          <div className="col-span-5">
            <div className="grid grid-cols-2 gap-x-1">
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
            <div className="grid grid-cols-6 gap-x-1">
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

        <div className="grid grid-cols-12 gap-1 border border-black p-1 mb-1">
          <div className="col-span-6">
            <div className="grid grid-cols-2 gap-x-1">
              <div className="text-left font-medium text-gray-600">
                Monthly Rate:
              </div>
              <div className="text-right">
                {formatPhp(selectedEmployee.monthly_rate)}
              </div>

              <div className="text-left font-medium text-gray-600">
                Daily Rate:
              </div>
              <div className="text-right">
                {formatPhp(selectedEmployee.daily_rate)}
              </div>

              <div className="text-left font-medium text-gray-600">
                Night Diff %:
              </div>
              <div className="text-right">
                {selectedEmployee.ndiff_pct != null
                  ? `${formatNum(selectedEmployee.ndiff_pct)} %`
                  : "-"}
              </div>

              <div className="text-left font-medium text-gray-600">
                Skills Allowance:
              </div>
              <div className="text-right">
                {formatPhp(selectedEmployee.skills_allowance)}
              </div>
            </div>
          </div>

          <div className="col-span-6">
            <div className="grid grid-cols-2 gap-x-1">
              <div className="text-left font-medium text-gray-600">
                Work Days to Pay:
              </div>
              <div className="text-right">
                {formatNum(selectedEmployee.unpaid_work_days)}
              </div>

              <div className="text-left font-medium text-gray-600">
                SL/VL Days to Pay:
              </div>
              <div className="text-right">
                {formatNum(selectedEmployee.unpaid_slvl_days)}
              </div>

              <div className="text-left font-medium text-gray-600">
                Reg Holidays to Pay:
              </div>
              <div className="text-right">
                {formatNum(selectedEmployee.holiday_days)}
              </div>

              <div className="text-left font-medium text-gray-600">
                Remaining SL Days:
              </div>
              <div className="text-right">
                {formatNum(selectedEmployee.sl_remaining_days)}
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-1 mb-1">
          <div className="w-1/2 border border-black p-1">
            <h4 className="font-bold mb-1">Final Pay Breakdown:</h4>

            <div className="mb-1 font-semibold">Wages:</div>

            <div className="flex justify-between">
              <span className="ml-3">Remaining Basic Pay:</span>
              <span>{formatPhp(selectedEmployee.remaining_basic_pay)}</span>
            </div>

            <div className="flex justify-between">
              <span className="ml-3">Remaining NDiff Pay:</span>
              <span>{formatPhp(selectedEmployee.ndiff_amount)}</span>
            </div>

            <div className="flex justify-between">
              <span className="ml-3">Remaining Holiday Pay:</span>
              <span>{formatPhp(selectedEmployee.holiday_pay_amount)}</span>
            </div>

            <div className="flex justify-between">
              <span className="ml-3">Remaining SL/VL:</span>
              <span>{formatPhp(selectedEmployee.remaining_vl_pay)}</span>
            </div>

            <div className="flex justify-between">
              <span className="ml-3">Remaining Skills Allowance:</span>
              <span>{formatPhp(selectedEmployee.skills_allowance_amount)}</span>
            </div>

            <div className="flex justify-between">
              <span className="ml-3">13th Month Pay:</span>
              <span>{formatPhp(selectedEmployee.thirteenth_month_total)}</span>
            </div>

            <div className="flex justify-between">
              <span className="ml-3">SL Conversion:</span>
              <span>{formatPhp(selectedEmployee.sl_remaining)}</span>
            </div>

            <div className="mt-1 font-semibold">Adjustments:</div>

            <div className="flex justify-between">
              <span className="ml-3">Adjustment Amount:</span>
              <span>{formatPhp(selectedEmployee.adjustment_amount)}</span>
            </div>

            <div className="flex justify-between mt-1">
              <span className="font-semibold">Gross Remaining Pay:</span>
              <span className="font-bold">
                {formatPhp(selectedEmployee.other_due_to_employee)}
              </span>
            </div>
          </div>

          <div className="w-1/2 border border-black p-1">
            <h4 className="font-bold mb-1">Tax Calculation:</h4>

            <div className="flex justify-between">
              <span className="font-semibold ml-3">
                YTD Gross Compensation:
              </span>
              <span>{formatPhp(selectedEmployee.ytd_gross_compensation)}</span>
            </div>

            <div className="font-semibold ml-3 mt-1">Less:</div>

            <div className="flex justify-between">
              <span className="ml-6">13th Month Pay:</span>
              <span>{formatDiff(selectedEmployee.thirteenth_month_capped)}</span>
            </div>

            <div className="flex justify-between">
              <span className="ml-6">SSS / PHIC / HDMF:</span>
              <span>{formatDiff(selectedEmployee.sss_phic_hdmf)}</span>
            </div>

            <div className="flex justify-between">
              <span className="ml-6">Skills Allowance:</span>
              <span>
                {formatDiff(toNumber(selectedEmployee.total_skills_allowance))}
              </span>
            </div>

            <div className="flex justify-between">
              <span className="ml-6">Consumed SL/VL:</span>
              <span>{formatDiff(toNumber(selectedEmployee.remaining_vl_pay))}</span>
            </div>

            <div className="flex justify-between">
              <span className="ml-6">Other Non-Tax Compensation:</span>
              <span>
                {formatDiff(toNumber(selectedEmployee.other_non_tax_compensation))}
              </span>
            </div>

            <div className="flex justify-between mt-1">
              <span className="font-semibold ml-3">Net Taxable Income:</span>
              <span>{formatPhp(selectedEmployee.net_taxable_income)}</span>
            </div>

            <div className="flex justify-between">
              <span className="font-semibold ml-3">Total Tax Due:</span>
              <span>{formatPhp(selectedEmployee.tax_due)}</span>
            </div>

            <div className="flex justify-between mt-1">
              <span className="font-semibold ml-3">
                Total Withholding Tax Deductions:
              </span>
              <span>
                {formatPhp(selectedEmployee.total_withholding_tax_deductions)}
              </span>
            </div>

            <div className="flex justify-between mt-1">
              <span className="font-semibold ml-3">
                {taxDiff > 0 ? "Remaining Tax Due:" : "Tax Refund:"}
              </span>

              <span className={taxDiff > 0 ? "text-red-600" : ""}>
                {taxDiff > 0
                  ? `(${formatPhp(taxDiff)})`
                  : formatPhp(Math.abs(taxDiff))}
              </span>
            </div>
          </div>
        </div>

        <div className="border border-black p-1">
          <h4 className="font-bold mb-1">Final Pay Summary:</h4>

          <div className="grid grid-cols-6 gap-1">
            <div className="col-span-4 font-semibold">
              Gross Remaining Pay:
            </div>
            <div className="col-span-2 text-right font-semibold">
              {formatPhp(selectedEmployee.other_due_to_employee)}
            </div>

            <div className="col-span-4 font-semibold">
              Add: Other Adjustments:
            </div>
            <div className="col-span-2 text-right font-semibold">
              {formatPhp(selectedEmployee.others)}
            </div>

            {taxDiff <= 0 && (
              <>
                <div className="col-span-4 font-semibold pl-6">Tax Refund:</div>
                <div className="col-span-2 text-right font-semibold">
                  {formatPhp(Math.abs(taxDiff))}
                </div>
              </>
            )}

            <div className="col-span-4 font-bold">Gross Final Pay:</div>
            <div className="col-span-2 text-right font-bold">
              {formatPhp(grossFinalPay)}
            </div>

            <div className="col-span-4 font-semibold text-red-700">
              Less: Partial 13th Month Pay:
            </div>
            <div className="col-span-2 text-right font-semibold text-red-700">
              {formatPhp(selectedEmployee.thirteenth_month_partial)}
            </div>

            {taxDiff > 0 && (
              <>
                <div className="col-span-4 font-semibold pl-6 text-red-700">
                  Tax Due:
                </div>
                <div className="col-span-2 text-right font-semibold text-red-700">
                  ({formatPhp(taxDiff)})
                </div>
              </>
            )}

            <div className="col-span-4 pl-6 font-semibold text-red-700">
              Outstanding Company Loans:
            </div>
            <div className="col-span-2 text-right font-semibold text-red-700">
              {formatPhp(selectedEmployee.outstanding_company_loans)}
            </div>

            <div className="col-span-4 pl-6 font-semibold text-red-700">
              Other Accountabilities:
            </div>
            <div className="col-span-2 text-right font-semibold text-red-800">
              {formatPhp(selectedEmployee.other_accountabilities)}
            </div>

            <div className="col-span-4 font-bold text-gray-900">
              Net Final Pay:
            </div>
            <div className="col-span-2 text-right font-bold text-[12px]">
              {formatPhp(finalPay)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrintableFinalPay;