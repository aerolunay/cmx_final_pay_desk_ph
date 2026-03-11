import React, { useEffect, useRef, useMemo, useState, useCallback  } from "react";
import { useNavigate } from "react-router-dom";
import AppHeader from "../common/AppHeader";
import axios from "axios";
import { SERVER_URL } from "../lib/constants";

const INITIAL_FORM_DATA = {
  empID: "",
  Name: "",
  position: "",
  tin: "",
  address: "",
  birthday: "",
  monthly_rate: "",
  daily_rate: "",
  bank_account_number: "",
  date_hired: "",
  last_payout_cutoff: "",
  date_resigned: "",
  unpaid_work_days: "",
  unpaid_slvl_days: "",
  ndiff_pct: "10",
  skills_allowance: "",
  holiday_days: "",
  sl_remaining_days: "",
  remaining_basic_pay: "",
  remaining_vl_pay: "",
  ndiff_amount: "",
  skills_allowance_amount: "",
  holiday_pay_amount: "",
  adjustment_amount: "",
  others: "",
  other_due_to_employee: "",
  sl_remaining: "",
  other_accountabilities: "",
  outstanding_company_loans: "",
  thirteenth_month_partial: "",
  ytd_gross_compensation: "",
  less_non_taxable_comp: "",
  thirteenth_month_capped: "",
  sss_phic_hdmf: "",
  other_non_tax_compensation: "",
  net_taxable_income: "",
  tax_due: "",
  total_withholding_tax_deductions: "",
  tax_due_refund: "",
  total_final_pay: "",
  contact: "",
  ytdAddOn: "",
  dob: "",
  thirteenth_month_total: "",
  skills_allowance_total: ""
};

const Sidebar = ({
  searchQuery,
  setSearchQuery,
  selectedEmployee,
  setSelectedEmployee,
  filteredEmployees,
}) => {
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [isFocused, setIsFocused] = useState(false); // 🔸 New
  const inputRef = useRef(null);
  const optionsRef = useRef([]);

  useEffect(() => {
    setFocusedIndex(-1);
    optionsRef.current = [];
  }, [filteredEmployees]);

  const handleKeyDown = (e) => {
    const max = filteredEmployees.length - 1;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      const nextIndex = focusedIndex < max ? focusedIndex + 1 : 0;
      setFocusedIndex(nextIndex);
      optionsRef.current[nextIndex]?.scrollIntoView({ block: "nearest" });
    }

    if (e.key === "ArrowUp") {
      e.preventDefault();
      const nextIndex = focusedIndex > 0 ? focusedIndex - 1 : max;
      setFocusedIndex(nextIndex);
      optionsRef.current[nextIndex]?.scrollIntoView({ block: "nearest" });
    }

    if (e.key === "Enter" && focusedIndex >= 0) {
      e.preventDefault();
      const selected = filteredEmployees[focusedIndex];
      if (selected) {
        setSelectedEmployee(selected);
        setSearchQuery("");
        setIsFocused(false); // 🧼 hide list
      }
    }
  };

  return (
    <aside className="w-64 bg-white p-4 border-r">
      <input
        ref={inputRef}
        placeholder="Search Employee Name"
        value={selectedEmployee?.employee_name || searchQuery}
        onChange={(e) => {
          setSearchQuery(e.target.value);
          setSelectedEmployee(null);
        }}
        onFocus={() => setIsFocused(true)} // 🔸 show list on focus
        onBlur={() => {
          // 🧠 Delay blur to allow click on option
          setTimeout(() => setIsFocused(false), 100);
        }}
        onKeyDown={handleKeyDown}
        className="w-full border px-3 py-2 rounded"
      />

      {(isFocused || searchQuery) && !selectedEmployee && (
        <div className="mt-1 border rounded bg-white shadow max-h-64 overflow-y-auto">
          {filteredEmployees.map((emp, i) => (
            <div
              key={i}
              ref={(el) => (optionsRef.current[i] = el)}
              tabIndex={0}
              onClick={() => {
                setSelectedEmployee(emp);
                setSearchQuery("");
                setIsFocused(false); // 🧼 hide list
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  setSelectedEmployee(emp);
                  setSearchQuery("");
                  setIsFocused(false); // 🧼 hide list
                }
              }}
              className={`px-3 py-2 cursor-pointer ${
                i === focusedIndex ? "bg-blue-100" : "hover:bg-blue-50"
              }`}
            >
              {emp.employee_name}
            </div>
          ))}
        </div>
      )}
    </aside>
  );
};


const ProcessFinalPay = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [empListData, setEmpListData] = useState([]);
  const [ytdPayrollData, setYtdPayrollData] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredEmployees, setFilteredEmployees] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [lastPayoutCutoff, setLastPayoutCutoff] = useState("");
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [confirmationType, setConfirmationType] = useState("success"); // or "error"
  const [confirmationMessage, setConfirmationMessage] = useState("");
  const [formData, setFormData] = useState(INITIAL_FORM_DATA);

  
  /* ================= FETCH DATA ================= */

  useEffect(() => {
    fetchEmployeeList();
    fetchYTDPayrollData();
  }, []);

   const fetchEmployeeList = async () => {
    try {
      const res = await axios.get(`${SERVER_URL}/api/employees`);
      setEmpListData(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Fetch employees error:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchYTDPayrollData = async () => {
    try {
      const res = await axios.get(`${SERVER_URL}/api/ytdPayrollData`);
      setYtdPayrollData(Array.isArray(res.data?.data) ? res.data.data : []);
    } catch (err) {
      console.error("Fetch YTD payroll error:", err);
    } finally {
      setLoading(false);
    }
  };

  const isSaveDisabled = useMemo(() => {
    const requiredFields = [
      "contact",
      "address",
      "monthly_rate",
      "skills_allowance",
      "ndiff_pct",
      "unpaid_work_days",
      "unpaid_slvl_days",
      "holiday_days",
      "sl_remaining_days",
      "thirteenth_month_partial",
      "thirteenth_month_capped",
      "adjustment_amount",
      "others",
      "outstanding_company_loans",
      "other_accountabilities",
      "other_non_tax_compensation",
      "skills_allowance_amount",
    ];

    return requiredFields.some((field) => {
      const value = formData[field];

      // Consider "--" or empty as invalid
      return (
        value === undefined ||
        value === null ||
        value.toString().trim() === "" ||
        value.toString().trim() === "--"
      );
    });
  }, [formData]);


  /* ================= FILTER ================= */

  useEffect(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) {
      setFilteredEmployees([]);
      return;
    }

    setFilteredEmployees(
      empListData.filter((emp) =>
        (emp.employee_name || "").toLowerCase().includes(q)
      )
    );
  }, [searchQuery, empListData]);

  /* ================= PAYROLL MATCH ================= */

  const matchedPayrollData = useMemo(() => {
    if (!selectedEmployee) return null;

    const empId =
      selectedEmployee.employeeId ||
      selectedEmployee.EMPLOYEEID ||
      selectedEmployee.employee_id;

    return (
      ytdPayrollData.find(
        (data) => String(data.employee_id) === String(empId)
      ) || null
    );
  }, [selectedEmployee, ytdPayrollData]);

  /* ================= UTILS ================= */

  const parsePesoNumber = (value) => {
    if (value === null || value === undefined) return value;
    if (typeof value === "number") return value;

    const str = String(value).trim();

    // Check if value is enclosed in parentheses (e.g., (₱1,000.00))
    const isNegative = str.startsWith("(") && str.endsWith(")");

    // Remove parentheses if present
    const cleanedStr = str.replace(/[()]/g, "").replace("₱", "").replace(/,/g, "").trim();

    const parsed = Number(cleanedStr);
    if (isNaN(parsed)) return value;

    return isNegative ? -parsed : parsed;
  };

  const toISODate = (val) => {
    if (!val) return "";

    // If already in YYYY-MM-DD format
    if (typeof val === "string" && /^\d{4}-\d{2}-\d{2}$/.test(val.trim())) {
      return val.trim();
    }

    // If in full datetime format or Date object
    const d = new Date(val);
    return isNaN(d) ? "" : d.toISOString().split("T")[0];
  };


  const toNumber = (val) => {
    if (val === "" || val === null || val === undefined) return 0;

    const v =
      typeof val === "string"
        ? val.replace(/₱/g, "").replace(/,/g, "").replace(/%/g, "").trim()
        : val;

    const parsed = Number(v);
    return isNaN(parsed) ? 0 : parsed;
  };

  const formatTIN = (tin) => {
    if (!tin) return "";
    const digitsOnly = tin.replace(/\D/g, ""); // remove non-digits
    const chunks = digitsOnly.match(/.{1,3}/g) || [];
    return `${chunks.join("-")}-000`;
  };

  const formatDate = (dateStr) =>
    dateStr
      ? new Date(dateStr).toLocaleDateString("en-US", {
          month: "2-digit",
          day: "2-digit",
          year: "numeric",
        })
      : "—";

  const getLastPayoutCutoff = (emp) => {
    if (!emp?.SEPARATIONDATE) return "";
    const d = new Date(emp.SEPARATIONDATE);
    if (isNaN(d)) return "";

    let y = d.getFullYear();
    let m = d.getMonth();
    const day = d.getDate();

    let cutoffDay = 23;

    if (day <= 7) {
      m -= 1;
      if (m < 0) {
        m = 11;
        y -= 1;
      }
    } else if (day <= 22) {
      cutoffDay = 8;
    }

    // Return MM/DD/YYYY for display (you also store ISO in formData)
    return new Date(y, m, cutoffDay).toLocaleDateString("en-US", {
      month: "2-digit",
      day: "2-digit",
      year: "numeric",
    });
  };

/* ================= FORM HELPERS ================= */

  const setField = useCallback((field) => (value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }, []);

  const resetForm = () => {
    setFormData(INITIAL_FORM_DATA);
    setLastPayoutCutoff("");

    setSearchQuery("");
    setSelectedEmployee(null);

  };

  const formatPhp = (value) => {
  const num = parseFloat(value);
  return isNaN(num)
    ? "₱0.00"
    : "₱" +
        num.toLocaleString("en-PH", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });
};

  const TaxDueRefundRow = () => {
    const val = toNumber(formData.tax_due_refund);
    const isRefund = val < 0;
    const isDue = val > 0;

    if (val === 0) return null;

    return (
      <div className="flex items-center gap-4 py-1">
        <label
          className={`w-[75%] text-xs font-bold text-gray-700 ${
            isDue ? "pl-14" : ""
          }`}
        >
          {isRefund ? "Tax Refund:" : "Tax Due:"}
        </label>

        <input
          id="tax_due_refund"
          name="tax_due_refund"
          type="text"
          readOnly
          tabIndex={-1}
          value={
            "₱" +
            Math.abs(val).toLocaleString("en-PH", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })
          }
          className="flex-1 w-[25%] border border-gray-300 p-1 rounded text-xs bg-gray-100 cursor-not-allowed text-right font-bold"
        />
      </div>
    );
  };


  


  /* ================= Calculations ================= */

 /* Auto Cut Off */
  useEffect(() => {
    if (!selectedEmployee) {
      setLastPayoutCutoff("");
      return;
    }
    setLastPayoutCutoff(getLastPayoutCutoff(selectedEmployee));
  }, [selectedEmployee]);

  /* Daily Rate */
  useEffect(() => {
    const rawMonthly = parseFloat(formData.monthly_rate.replace(/[^0-9.]/g, "") || "0");
    const daily = rawMonthly > 0 ? (rawMonthly * 12) / 260 : 0;

    const formatted = daily
      ? "₱" + daily.toLocaleString("en-PH", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })
      : "";

    // Only update if different
    if (formData.daily_rate !== formatted) {
      setFormData((prev) => ({
        ...prev,
        daily_rate: formatted,
      }));
    }
  }, [formData.monthly_rate]);

  /* Remaining Basic */
  useEffect(() => {
    const workDays = parseFloat(formData.unpaid_work_days);
    const dailyRateRaw = formData.daily_rate?.toString().replace(/[^0-9.]/g, "");

    const dailyRate = parseFloat(dailyRateRaw);

    if (!isNaN(workDays) && !isNaN(dailyRate)) {
      const total = workDays * dailyRate;

      setFormData((prev) => ({
        ...prev,
        remaining_basic_pay: `₱${total.toLocaleString("en-PH", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`,
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        remaining_basic_pay: "₱0.00",
      }));
    }
  }, [formData.unpaid_work_days, formData.daily_rate]);

  /* Consumed SL/VL */
  useEffect(() => {
    const slvlDays = parseFloat(formData.unpaid_slvl_days);
    const dailyRateRaw = formData.daily_rate?.toString().replace(/[^0-9.]/g, "");

    const dailyRate = parseFloat(dailyRateRaw);

    if (!isNaN(slvlDays) && !isNaN(dailyRate)) {
      const total = slvlDays * dailyRate;

      setFormData((prev) => ({
        ...prev,
        remaining_vl_pay: `₱${total.toLocaleString("en-PH", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`,
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        remaining_vl_pay: "₱0.00",
      }));
    }
  }, [formData.unpaid_slvl_days, formData.daily_rate]);

  /* Holiday */
  useEffect(() => {
    const hdyDays = parseFloat(formData.holiday_days);
    const dailyRateRaw = formData.daily_rate?.toString().replace(/[^0-9.]/g, "");

    const dailyRate = parseFloat(dailyRateRaw);

    if (!isNaN(hdyDays) && !isNaN(dailyRate)) {
      const total = hdyDays * dailyRate;

      setFormData((prev) => ({
        ...prev,
        holiday_pay_amount: `₱${total.toLocaleString("en-PH", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`,
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        holiday_pay_amount: "₱0.00",
      }));
    }
  }, [formData.holiday_days, formData.daily_rate]);
  

  /* SL Conversion */
  useEffect(() => {
    const SLDays = parseFloat(formData.sl_remaining_days);
    const dailyRateRaw = formData.daily_rate?.toString().replace(/[^0-9.]/g, "");

    const dailyRate = parseFloat(dailyRateRaw);

    if (!isNaN(SLDays) && !isNaN(dailyRate)) {
      const total = SLDays * dailyRate;

      setFormData((prev) => ({
        ...prev,
        sl_remaining: `₱${total.toLocaleString("en-PH", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`,
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        sl_remaining: "₱0.00",
      }));
    }
  }, [formData.sl_remaining_days, formData.daily_rate]);

  /* Night Diff */
  useEffect(() => {
    const remainingPayRaw = formData.remaining_basic_pay?.toString().replace(/[^0-9.]/g, "");
    const remainingPay = parseFloat(remainingPayRaw);

    const ndiffVal = formData.ndiff_pct?.toString().trim();

    let computed = 0;

    if (ndiffVal.includes("%")) {
      const percent = parseFloat(ndiffVal.replace(/[^0-9.]/g, ""));
      if (!isNaN(remainingPay) && !isNaN(percent)) {
        computed = remainingPay * (percent / 100) * 0.78;
      }
    } else if (ndiffVal.includes("₱")) {
      const pesoVal = parseFloat(ndiffVal.replace(/[^0-9.]/g, ""));
      if (!isNaN(pesoVal)) {
        computed = pesoVal;
      }
    }

    setFormData((prev) => ({
      ...prev,
      ndiff_amount: computed
        ? `₱${computed.toLocaleString("en-PH", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}`
        : "₱0.00",
    }));
  }, [formData.ndiff_pct, formData.remaining_basic_pay]);

  /* 13th Month – Non-Taxable Portion (Max ₱90,000) */
  useEffect(() => {
    const total13th = toNumber(formData.thirteenth_month_total);

    if (!total13th) {
      setFormData((prev) => ({
        ...prev,
        thirteenth_month_capped: "₱0.00",
      }));
      return;
    }

    const capped = Math.min(total13th, 90000);

    setFormData((prev) => ({
      ...prev,
      thirteenth_month_capped:
        "₱" +
        capped.toLocaleString("en-PH", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }),
    }));
  }, [formData.thirteenth_month_total]);


  /* Skills Allowance Pro Rated*/
  useEffect(() => {
    const rawAllowance = formData.skills_allowance || "";
    const rawUnpaidDays = parseFloat(formData.unpaid_work_days || "0");

    let numericAllowance = 0;

    // Remove ₱ or % and parse to number
    if (typeof rawAllowance === "string") {
      const cleaned = rawAllowance.replace(/[^0-9.]/g, "");
      numericAllowance = parseFloat(cleaned) || 0;
    }

    // Calculate allowance amount
    const computed =
      ((numericAllowance * 12) / 260) * rawUnpaidDays;

    // Format as Peso currency
    const formatted =
      !isNaN(computed) && computed > 0
        ? "₱" +
          computed.toLocaleString("en-PH", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })
        : "";

    setFormData((prev) => ({
      ...prev,
      skills_allowance_amount: formatted,
    }));
  }, [formData.skills_allowance, formData.unpaid_work_days]);

  /* Due to Employee */
  useEffect(() => {
    const fieldsToSum = [
      formData.remaining_basic_pay,
      formData.ndiff_amount,
      formData.remaining_vl_pay,
      formData.holiday_pay_amount,
      formData.sl_remaining,
      formData.skills_allowance_amount,
      formData.thirteenth_month_total,
      formData.adjustment_amount,
    ];

    const parseCurrency = (val) => {
      if (!val) return 0;
      const numeric = parseFloat(val.toString().replace(/[^0-9.]/g, ""));
      return isNaN(numeric) ? 0 : numeric;
    };

    const total = fieldsToSum.reduce((sum, val) => sum + parseCurrency(val), 0);

    const formatted = "₱" + total.toLocaleString("en-PH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

    setFormData((prev) => ({
      ...prev,
      other_due_to_employee: formatted,
    }));
  }, [
    formData.remaining_basic_pay,
    formData.ndiff_amount,
    formData.remaining_vl_pay,
    formData.holiday_pay_amount,
    formData.sl_remaining,
    formData.skills_allowance_amount,
    formData.thirteenth_month_capped,
    formData.adjustment_amount,
  ]);

 /* YTD Add On */
  useEffect(() => {
    const fieldsToSum = [
      formData.remaining_basic_pay,
      formData.ndiff_amount,
      formData.remaining_vl_pay,
      formData.holiday_pay_amount,
      formData.sl_remaining,
      formData.skills_allowance_amount,
      formData.adjustment_amount,
    ];

    const parseCurrency = (val) => {
      if (!val) return 0;
      const numeric = parseFloat(val.toString().replace(/[^0-9.]/g, ""));
      return isNaN(numeric) ? 0 : numeric;
    };

    const total = fieldsToSum.reduce((sum, val) => sum + parseCurrency(val), 0);

    const formatted = "₱" + total.toLocaleString("en-PH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

    setFormData((prev) => ({
      ...prev,
      ytdAddOn: formatted,
    }));
  }, [
      formData.thirteenth_month_total,
      formData.remaining_basic_pay,
      formData.ndiff_amount,
      formData.remaining_vl_pay,
      formData.holiday_pay_amount,
      formData.sl_remaining,
      formData.skills_allowance_amount,
      formData.adjustment_amount,
  ]);

 /* Total Skills Allowance */
  useEffect(() => {
    const skillsAllowanceAmount = toNumber(formData.skills_allowance_amount); // your manual input
    const matchedAllowanceRaw = matchedPayrollData?.skills_allowance;

    // Convert to number safely: treat null, undefined, or '-' as 0
    const matchedSkillsAllowance =
      matchedAllowanceRaw && matchedAllowanceRaw !== '-'
        ? toNumber(matchedAllowanceRaw)
        : 0;

    const net = matchedSkillsAllowance + skillsAllowanceAmount;

    setFormData((prev) => ({
      ...prev,
      skills_allowance_total:
        net > 0
          ? "₱" + net.toLocaleString("en-PH", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })
          : "--",
    }));
  }, [
    formData.skills_allowance_amount, // update this to watch the correct field
    matchedPayrollData?.skills_allowance,
  ]);


  /* Gross YTD */
  useEffect(() => {
    const parseCurrency = (val) => {
      if (!val) return 0;
      const num = parseFloat(val.toString().replace(/[^0-9.]/g, ""));
      return isNaN(num) ? 0 : num;
    };

    const totalSalary = parseCurrency(matchedPayrollData?.total_salary);
    const otherDue = parseCurrency(formData.ytdAddOn);
    const total = totalSalary + otherDue;

    const formatted = "₱" + total.toLocaleString("en-PH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

    setFormData((prev) => ({
      ...prev,
      ytd_gross_compensation: formatted,
    }));
  }, [matchedPayrollData?.total_salary, formData.ytdAddOn]);

  
 /* Less Non Tax Comp */
  useEffect(() => {
    const fieldsToSum = [
      formData.other_non_tax_compensation,
      formData.remaining_vl_pay,
      formData.sss_phic_hdmf,
      formData.thirteenth_month_capped,
      formData.skills_allowance_total
    ];

    const parseCurrency = (val) => {
      if (!val) return 0;
      const numeric = parseFloat(val.toString().replace(/[^0-9.]/g, ""));
      return isNaN(numeric) ? 0 : numeric;
    };

    const total = fieldsToSum.reduce((sum, val) => sum + parseCurrency(val), 0);

    const formatted = "₱" + total.toLocaleString("en-PH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

    setFormData((prev) => ({
      ...prev,
      less_non_taxable_comp: formatted,
    }));
  }, [
      formData.other_non_tax_compensation,
      formData.remaining_vl_pay,
      formData.sss_phic_hdmf,
      formData.thirteenth_month_capped,
      formData.skills_allowance_total
  ]);


 /* Taxable Comp */
  useEffect(() => {
    const gross = toNumber(formData.ytd_gross_compensation);
    const lessNonTax = toNumber(formData.less_non_taxable_comp);

    const net = gross - lessNonTax;

    setFormData((prev) => ({
      ...prev,
      net_taxable_income:
        net > 0
          ? "₱" + net.toLocaleString("en-PH", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })
          : "--",
    }));
  }, [
    formData.ytd_gross_compensation,
    formData.less_non_taxable_comp,
  ]);


  const calculateTaxDue = (netTaxableIncome) => {
    const income = Number(netTaxableIncome) || 0;

    if (income <= 250000) {
      return 0;
    }

    if (income <= 400000) {
      return (income - 250000) * 0.15;
    }

    if (income <= 800000) {
      return 22500 + (income - 400000) * 0.20;
    }

    if (income <= 2000000) {
      return 102500 + (income - 800000) * 0.25;
    }

    if (income <= 8000000) {
      return 402500 + (income - 2000000) * 0.30;
    }

    return 2202500 + (income - 8000000) * 0.35;
  };

  useEffect(() => {
    const net = toNumber(formData.net_taxable_income);
    const tax = calculateTaxDue(net);

    setFormData((prev) => ({
      ...prev,
      tax_due:
        tax > 0
          ? "₱" + tax.toLocaleString("en-PH", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })
          : "₱0.00",
    }));
  }, [formData.net_taxable_income]);


  useEffect(() => {
  const taxDue = toNumber(formData.tax_due);
  const withholding = toNumber(formData.total_withholding_tax_deductions);

  const taxDueRefund = taxDue - withholding;

  setFormData((prev) => ({
    ...prev,
    tax_due_refund:
      "₱" + taxDueRefund.toLocaleString("en-PH", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
  }));
}, [
  formData.tax_due,
  formData.total_withholding_tax_deductions,
]);


useEffect(() => {
  const dueToEmployee =
    toNumber(formData.other_due_to_employee) +
    toNumber(formData.others);

  const deductions =
    parsePesoNumber(formData.thirteenth_month_partial) +
    parsePesoNumber(formData.tax_due_refund) +
    parsePesoNumber(formData.outstanding_company_loans) +
    parsePesoNumber(formData.other_accountabilities);

  const totalFinalPay = dueToEmployee - deductions;

  setFormData((prev) => ({
    ...prev,
    total_final_pay:
      "₱" +
      totalFinalPay.toLocaleString("en-PH", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
  }));
}, [
  formData.other_due_to_employee,
  formData.thirteenth_month_partial,
  formData.tax_due_refund,
  formData.outstanding_company_loans,
  formData.other_accountabilities,
  formData.others
]);


  /* ================= Set Form Data (GUARDED) ================= */

  useEffect(() => {
    if (!selectedEmployee || !matchedPayrollData) return;
    setFormData((prev) => {
      // 🛑 If this employee is already loaded, DO NOT overwrite user input
      if (prev.empID === String(matchedPayrollData.employee_id)) {
        return prev;
      }

      return {
        ...INITIAL_FORM_DATA,
        

        empID: String(matchedPayrollData.employee_id || ""),
        Name: matchedPayrollData.fullname || "",
        position: matchedPayrollData.position || "",
        tin: selectedEmployee.TIN || "",
        address: selectedEmployee.ADDRESS || "",
        birthday: toISODate(selectedEmployee.dob),
        monthly_rate: selectedEmployee.BASICPAY
          ? "₱" + Number(parsePesoNumber(selectedEmployee.BASICPAY)).toLocaleString("en-PH", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })
          : "",
        bank_account_number: selectedEmployee.BANKACCT || "",
        date_hired: toISODate(matchedPayrollData.date_hired),
        last_payout_cutoff: toISODate(getLastPayoutCutoff(selectedEmployee.SEPARATIONDATE)),
        date_resigned: toISODate(selectedEmployee.SEPARATIONDATE),

        contact: selectedEmployee.CONTACTNO || "",
        ndiff_pct: (() => {
          const val = selectedEmployee.ND;

          if (val == null || val === "") return "--";

          if (typeof val === "string") {
            if (val.includes("%")) return val.trim();
            if (val.includes("₱")) return val.trim();
          }

          const num = parseFloat(val);
          if (isNaN(num)) return "--";

          return "₱" + num.toLocaleString("en-PH", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          });
        })(),

        // editable fields start EMPTY
        unpaid_work_days: "",
        unpaid_slvl_days: "",
        skills_allowance: (() => {
          const val = selectedEmployee.SKILLSALLOWANCE;

          if (val == null || val === "") return "";

          if (typeof val === "string") {
            if (val.includes("%")) return val.trim();
            if (val.includes("₱")) return val.trim();
          }

          const num = parseFloat(val);
          if (isNaN(num)) return "--";

          return "₱" + num.toLocaleString("en-PH", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          });
        })(),

        holiday_days: "",
        sl_remaining_days: "",
        remaining_vl_pay: "",
        ndiff_amount: "",
        skills_allowance_amount: "",
        holiday_pay_amount: "",
        adjustment_amount: "",
        others: "",
        other_due_to_employee: "",
        sl_remaining: "",
        other_accountabilities: "",
        outstanding_company_loans: "",
        thirteenth_month_partial: "",
        ytd_gross_compensation: "",       
        thirteenth_month_total: (() => {
          const val = matchedPayrollData["13th_month_nontaxable"];
          const num = toNumber(val);
          if (!num) return "";
          return "₱" + num.toLocaleString("en-PH", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          });
        })(),
        sss_phic_hdmf:  (() => {
          const val =   (toNumber(matchedPayrollData?.sss) +
                        toNumber(matchedPayrollData?.philhealth) +
                        toNumber(matchedPayrollData?.hdmf));

          if (val == null || val === "") return "--";

          if (typeof val === "string") {
            if (val.includes("%")) return val.trim();
            if (val.includes("₱")) return val.trim();
          }

          const num = parseFloat(val);
          if (isNaN(num)) return "--";

          return "₱" + num.toLocaleString("en-PH", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          });
        })(),
        skills_allowance_total: "",
        other_non_tax_compensation: "",
        net_taxable_income:"",
        tax_due: "",

        total_withholding_tax_deductions:matchedPayrollData.withholding_tax,

        tax_due_refund: "",
        total_final_pay: "",
        dob: toISODate(selectedEmployee.dob)
      };
    });
  }, [selectedEmployee, matchedPayrollData]);


  const handleSave = async () => {
    try {
      const payload = { ...formData };

      // Convert string currency/number fields to raw numbers
      const fieldsToClean = [
        "monthly_rate", "daily_rate", "remaining_basic_pay", "ndiff_amount",
        "skills_allowance_amount", "holiday_pay_amount", "remaining_vl_pay",
        "sl_remaining", "thirteenth_month_partial", "thirteenth_month_capped", 
        "thirteenth_month_total", "adjustment_amount", "others",
        "other_due_to_employee", "outstanding_company_loans", "other_accountabilities",
        "ytd_gross_compensation", "less_non_taxable_comp", "net_taxable_income",
        "tax_due", "total_withholding_tax_deductions", "tax_due_refund", "total_final_pay",
      ];

      fieldsToClean.forEach((key) => {
        payload[key] = toNumber(formData[key]);
      });

      // ✅ Add processed_by using localStorage
      const userId = localStorage.getItem("userId") || "";
      payload.processed_by = userId

      // ✅ Extract year from selectedEmployee.SEPARATIONDATE
      if (selectedEmployee?.SEPARATIONDATE) {
        const separationDate = new Date(selectedEmployee.SEPARATIONDATE);
        payload.year = separationDate.getFullYear();
      } else {
        payload.year = new Date().getFullYear(); // fallback
      }

      // ✅ Set processed_date as today's date (YYYY-MM-DD)
      payload.processed_date = new Date().toISOString().split("T")[0];

      // 🔁 Send to backend
      const response = await axios.post(
        `${SERVER_URL}/api/saveFinalPay`,
        payload
      );

      if (response.data.success) {
        resetForm();
        setConfirmationType("success");
        setConfirmationMessage("Final Pay record saved successfully.");
        setShowConfirmation(true);
      } else {
        setConfirmationType("error");
        setConfirmationMessage("Save failed: " + response.data.error);
        setShowConfirmation(true);
      }
    } catch (err) {
      console.error("Save failed:", err);
      setConfirmationType("error");
      setConfirmationMessage("Failed to save. Please check console for details.");
      setShowConfirmation(true);
    }

  };

  /* ================= RENDER ================= */

  return (
    <div className="h-screen bg-[#f5f7fa] flex flex-col">
      <AppHeader />

      <main className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <Sidebar
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          selectedEmployee={selectedEmployee}
          setSelectedEmployee={setSelectedEmployee}
          filteredEmployees={filteredEmployees}
        />

        {/* Main */}
        <section className="flex-1 p-2 overflow-auto">
          <div className="bg-white p-2 rounded shadow">
            {selectedEmployee && matchedPayrollData ? (
              <div className="space-y-5 key={formData.empID}">
                {/* SUMMARY */}
                <div className="text-sm border-2 rounded p-2">
                    <div className="text-xs font-bold text-gray-600 uppercase mb-2">
                      Employee Summary
                    </div>
                  <div className="grid grid-cols-2 gap-x-10 gap-y-3 p-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-4">
                        <label className="w-48 text-xs font-semibold text-gray-700">Employee ID:</label>
                        <input
                          value={formData.empID}
                          readOnly
                          tabIndex={-1}
                          className="flex-1 border border-gray-300 px-2 py-1 rounded text-xs bg-gray-100 cursor-not-allowed"
                        />
                      </div>
                      <div className="flex items-center gap-4">
                        <label className="w-48 text-xs font-semibold text-gray-700">Employee Name:</label>
                        <input
                          value={formData.Name}
                          readOnly
                          tabIndex={-1}
                          className="flex-1 border border-gray-300 px-2 py-1 rounded text-xs bg-gray-100 cursor-not-allowed"
                        />
                      </div>
                      <div className="flex items-center gap-4">
                        <label className="w-48 text-xs font-semibold text-gray-700">Position / Role:</label>
                        <input
                          value={formData.position}
                          readOnly
                          tabIndex={-1}
                          className="flex-1 border border-gray-300 px-2 py-1 rounded text-xs bg-gray-100 cursor-not-allowed"
                        />
                      </div>
                      <div className="flex items-center gap-4">
                        <label className="w-48 text-xs font-semibold text-gray-700">Hire Date:</label>
                        <input
                          value={formatDate(formData.date_hired)}
                          readOnly
                          tabIndex={-1}
                          className="flex-1 border border-gray-300 px-2 py-1 rounded text-xs bg-gray-100 cursor-not-allowed"
                        />
                      </div>
                      <div className="flex items-center gap-4">
                        <label className="w-48 text-xs font-semibold text-gray-700">Separation Date:</label>
                        <input
                          value={formatDate(formData.date_resigned)}
                          readOnly
                          tabIndex={-1}
                          className="flex-1 border border-gray-300 px-2 py-1 rounded text-xs bg-gray-100 cursor-not-allowed"
                        />
                      </div>                      
                    </div> 
        
                    <div className="space-y-1">
                      <div className="flex items-center gap-4">
                        <label className="w-48 text-xs font-semibold text-gray-700">Tax Identification No:</label>
                        <input
                          value={formatTIN(formData.tin)}
                          readOnly
                          tabIndex={-1}
                          className="flex-1 border border-gray-300 px-2 py-1 rounded text-xs bg-gray-100 cursor-not-allowed"
                        />
                      </div>
                      <div className="flex items-center gap-4">
                        <label className="w-48 text-xs font-semibold text-gray-700">Bank Account No:</label>
                        <input
                          value={formData.bank_account_number}
                          readOnly
                          tabIndex={-1}
                          className="flex-1 border border-gray-300 px-2 py-1 rounded text-xs bg-gray-100 cursor-not-allowed"
                        />
                      </div>
                      <div className="flex items-center gap-4">
                        <label className="w-48 text-xs font-semibold text-gray-700">Contact No:</label>
                        <input
                          id="contact"
                          name="contact"
                          type="text"
                          value={formData.contact}
                          tabIndex={1}
                          onChange={(e) => {
                            const input = e.target.value;

                            // Only allow numeric input and max 11 characters
                            if (/^\d{0,11}$/.test(input)) {
                              setFormData((prev) => ({
                                ...prev,
                                contact: input,
                              }));
                            }
                          }}
                          className="flex-1 border border-gray-300 px-2 py-1 rounded text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
                        />
                      </div>
                      <div className="flex items-start gap-4">
                        <label  className="w-48 text-xs font-semibold text-gray-700 pt-1">Address:</label>
                        <textarea
                          id="address"
                          name="address"
                          rows={3}
                          value={formData.address}
                          onChange={(e) =>
                            setFormData((prev) => ({
                              ...prev,
                              address: e.target.value,
                            }))
                          }
                          tabIndex={1}
                          className="flex-1 border border-gray-300 px-2 py-1 rounded text-xs resize-none bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
                        />
                      </div>
                    </div> 
                  </div>  
                </div>

                {/* Row 2 */}
                <div className="grid grid-cols-2 gap-x-5">
                  <div className="text-sm border-2 rounded p-2">
                    <div className="text-xs font-bold text-gray-600 uppercase mb-2">
                      Recent Compensation Details
                    </div>
                    <div> 
                      <div className="grid grid-cols-2 gap-x-10 gap-y-3 p-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-4">
                            <label className="w-[60%] text-xs font-semibold text-gray-700">Basic Monthly Salary:</label>
                            <input
                              id="monthly_rate"
                              name="monthly_rate"
                              type="text"
                              inputMode="decimal"
                              tabIndex={2}
                              value={formData.monthly_rate}
                              onFocus={(e) => {
                                // Remove ₱ and commas when focusing for editing
                                const raw = e.target.value.replace(/[^0-9.]/g, "");
                                setFormData((prev) => ({
                                  ...prev,
                                  monthly_rate: raw,
                                }));
                              }}
                              onChange={(e) => {
                                const input = e.target.value;
                                // Allow only numbers and decimal
                                const raw = input.replace(/[^0-9.]/g, "");
                                setFormData((prev) => ({
                                  ...prev,
                                  monthly_rate: raw,
                                }));
                              }}
                              onBlur={(e) => {
                                const rawValue = e.target.value.replace(/[^0-9.]/g, "");
                                const formatted =
                                  rawValue && !isNaN(rawValue)
                                    ? "₱" +
                                      Number(rawValue).toLocaleString("en-PH", {
                                        minimumFractionDigits: 2,
                                        maximumFractionDigits: 2,
                                      })
                                    : "";
                                setFormData((prev) => ({
                                  ...prev,
                                  monthly_rate: formatted,
                                }));
                              }}
                              placeholder="₱0.00"
                              className="flex-1 w-[40%] border border-gray-300 p-1 rounded text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 text-right"
                            />
                          </div>
                          <div className="flex items-center gap-4">
                            <label className="w-[60%] text-xs font-semibold text-gray-700">Basic Daily Salary:</label>
                            <input
                              id="daily_rate"
                              name="daily_rate"
                              type="text"
                              inputMode="decimal"
                              value={formData.daily_rate}
                              readOnly
                              tabIndex={-1}
                              placeholder="₱0.00"
                              className="flex-1 w-[40%] border border-gray-300 p-1 rounded text-xs bg-gray-100 cursor-not-allowed text-right"
                            />
                          </div>

                          <div className="flex items-center gap-4">
                            <label className="w-[60%] text-xs font-semibold text-gray-700">Skills Allowance:</label>
                            <input
                              id="skills_allowance"
                              name="skills_allowance"
                              type="text"
                              inputMode="decimal"
                              value={formData.skills_allowance}
                              tabIndex={3}
                              onFocus={(e) => {
                                // Remove ₱ and commas when focusing for editing
                                const raw = e.target.value.replace(/[^0-9.]/g, "");
                                setFormData((prev) => ({
                                  ...prev,
                                  skills_allowance: raw,
                                }));
                              }}
                              onChange={(e) => {
                                const input = e.target.value;
                                // Allow only numbers and decimal
                                const raw = input.replace(/[^0-9.]/g, "");
                                setFormData((prev) => ({
                                  ...prev,
                                  skills_allowance: raw,
                                }));
                              }}
                              onBlur={(e) => {
                                const rawValue = e.target.value.replace(/[^0-9.]/g, "");
                                const formatted =
                                  rawValue && !isNaN(rawValue)
                                    ? "₱" +
                                      Number(rawValue).toLocaleString("en-PH", {
                                        minimumFractionDigits: 2,
                                        maximumFractionDigits: 2,
                                      })
                                    : "";
                                setFormData((prev) => ({
                                  ...prev,
                                  skills_allowance: formatted,
                                }));
                              }}
                              placeholder="₱0.00"
                              className="flex-1 w-[40%] border border-gray-300 p-1 rounded text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 text-right"
                            />
                          </div>

                          <div className="flex items-center gap-4">
                            <label className="w-[60%] text-xs font-semibold text-gray-700">Night Diff:</label>
                            <input
                              id="ndiff_pct"
                              name="ndiff_pct"
                              type="text"
                              tabIndex={4}
                              value={
                                formData.ndiff_pct !== "" && formData.ndiff_pct !== null
                                  ? `${formData.ndiff_pct.replace(/%/g, "")}%`
                                  : ""
                              }
                              onChange={(e) => {
                                // Only allow numbers, remove any non-digit characters
                                const numeric = e.target.value.replace(/[^\d]/g, "");
                                setFormData((prev) => ({
                                  ...prev,
                                  ndiff_pct: numeric, // Store just the number
                                }));
                              }}
                              placeholder="0%"
                              className="flex-1 border w-[40%] border-gray-300 px-2 py-1 rounded text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 text-right"
                            />
                          </div>

                          <div className="flex items-center gap-4">
                            <label className="w-[60%] text-xs font-semibold text-gray-700">Remaining Work Days to Pay:</label>
                            <input
                              id="unpaid_work_days"
                              name="unpaid_work_days"
                              type="text"
                              inputMode="decimal"
                              value={formData.unpaid_work_days}
                              placeholder="0"
                              tabIndex={5}
                              onChange={(e) =>
                                setFormData((prev) => ({
                                  ...prev,
                                  unpaid_work_days: e.target.value,
                                }))
                              }
                              className="flex-1 w-[40%] border border-gray-300 p-1 rounded text-xs bg-white text-right focus:outline-none focus:ring-2 focus:ring-blue-400"
                            />
                          </div>
                          <div className="flex items-center gap-4">
                            <label className="w-[60%] text-xs font-semibold text-gray-700">Consumed SL/VL Days to Pay:</label>
                            <input
                              id="unpaid_slvl_days"
                              name="unpaid_slvl_days"
                              type="text"
                              inputMode="decimal"
                              value={formData.unpaid_slvl_days}
                              placeholder="0"
                              tabIndex={6}
                              onChange={(e) =>
                                setFormData((prev) => ({
                                  ...prev,
                                  unpaid_slvl_days: e.target.value,
                                }))
                              }
                              className="flex-1 border w-[40%] border-gray-300 p-1 rounded text-xs bg-white text-right focus:outline-none focus:ring-2 focus:ring-blue-400"
                            />
                          </div>
                          <div className="flex items-center gap-4">
                            <label className="w-[60%] text-xs font-semibold text-gray-700">Holidays to Pay:</label>
                            <input
                              id="holiday_days"
                              name="holiday_days"
                              type="text"
                              inputMode="decimal"
                              value={formData.holiday_days}
                              placeholder="0"
                              tabIndex={7}
                              onChange={(e) =>
                                setFormData((prev) => ({
                                  ...prev,
                                  holiday_days: e.target.value,
                                }))
                              }
                              className="flex-1 w-[40%] border border-gray-300 p-1 rounded text-xs bg-white text-right focus:outline-none focus:ring-2 focus:ring-blue-400"
                            />
                          </div>
                          <div className="flex items-center gap-4">
                            <label className="w-[60%] text-xs font-semibold text-gray-700">Remaining SL (Days) for Conversion:</label>
                            <input
                              id="sl_remaining_days"
                              name="sl_remaining_days"
                              type="text"
                              inputMode="decimal"
                              value={formData.sl_remaining_days}
                              placeholder="0"
                              tabIndex={8}
                              onChange={(e) =>
                                setFormData((prev) => ({
                                  ...prev,
                                  sl_remaining_days: e.target.value,
                                }))
                              }
                              className="flex-1 border w-[40%] border-gray-300 p-1 rounded text-xs bg-white text-right focus:outline-none focus:ring-2 focus:ring-blue-400"
                            />
                          </div> 
                        </div> 

                        <div className="space-y-1">
                          <div className="flex items-center gap-4">
                            <label className="w-[60%] text-xs font-semibold text-gray-700">Remaining Basic Pay:</label>
                            <input
                              id="remaining_basic_pay"
                              name="remaining_basic_pay"
                              type="text"
                              inputMode="decimal"
                              value={formData.remaining_basic_pay}
                              readOnly
                              tabIndex={-1}
                              placeholder="₱0.00"
                              className="flex-1 border border-gray-300 p-1 rounded text-xs bg-gray-100 cursor-not-allowed w-[40%] text-right"
                            />
                          </div>
                          <div className="flex items-center gap-4">
                            <label className="w-[60%] text-xs font-semibold text-gray-700">Remaining Night Diff:</label>
                            <input
                              id="ndiff_amount"
                              name="ndiff_amount"
                              type="text"
                              inputMode="decimal"
                              value={formData.ndiff_amount}
                              readOnly
                              tabIndex={-1}
                              placeholder="₱0.00"
                              className="flex-1 border border-gray-300 p-1 rounded text-xs bg-gray-100 cursor-not-allowed w-[40%] text-right"
                            />
                          </div>
                          <div className="flex items-center gap-4">
                            <label className="w-[60%] text-xs font-semibold text-gray-700">Consumed SL/VL:</label>
                            <input
                              id="remaining_vl_pay"
                              name="remaining_vl_pay"
                              type="text"
                              inputMode="decimal"
                              value={formData.remaining_vl_pay}
                              readOnly
                              tabIndex={-1}
                              placeholder="₱0.00"
                              className="flex-1 border border-gray-300 p-1 rounded text-xs bg-gray-100 cursor-not-allowed w-[40%] text-right"
                            />
                          </div>
                          <div className="flex items-center gap-4">
                            <label className="w-[60%] text-xs font-semibold text-gray-700">Remaining Holiday Pay:</label>
                            <input
                              id="holiday_pay_amount"
                              name="holiday_pay_amount"
                              type="text"
                              inputMode="decimal"
                              value={formData.holiday_pay_amount}
                              readOnly
                              tabIndex={-1}
                              placeholder="₱0.00"
                              className="flex-1 border border-gray-300 p-1 rounded text-xs bg-gray-100 cursor-not-allowed w-[40%] text-right"
                            />
                          </div>
                          
                          <div className="flex items-center gap-4">
                            <label className="w-[60%] text-xs font-semibold text-gray-700">SL Conversion:</label>
                            <input
                              id="sl_remaining"
                              name="sl_remaining"
                              type="text"
                              inputMode="decimal"
                              value={formData.sl_remaining}
                              readOnly
                              tabIndex={-1}
                              placeholder="₱0.00"
                              className="flex-1 border border-gray-300 p-1 rounded text-xs bg-gray-100 cursor-not-allowed w-[40%] text-right"
                            />
                          </div>
                          
                          <div className="flex items-center gap-4">
                            <label className="w-[60%] text-xs font-semibold text-gray-700">13th Month Pay:</label>
                            <input
                              id="thirteenth_month_total"
                              name="thirteenth_month_total"
                              type="text"
                              value={formData.thirteenth_month_total}
                              tabIndex={9}
                              onFocus={(e) => {
                                // Strip ₱ and commas for editing
                                const raw = e.target.value.replace(/[₱,]/g, "");
                                setFormData((prev) => ({
                                  ...prev,
                                  thirteenth_month_total: raw,
                                }));
                              }}
                              onChange={(e) => {
                                const cleaned = e.target.value.replace(/[^0-9.]/g, "");
                                setFormData((prev) => ({
                                  ...prev,
                                  thirteenth_month_total: cleaned,
                                }));
                              }}
                              onBlur={(e) => {
                                const raw = parseFloat(e.target.value);
                                const formatted = !isNaN(raw)
                                  ? "₱" +
                                    raw.toLocaleString("en-PH", {
                                      minimumFractionDigits: 2,
                                      maximumFractionDigits: 2,
                                    })
                                  : "";
                                setFormData((prev) => ({
                                  ...prev,
                                  thirteenth_month_total: formatted,
                                }));
                              }}
                              placeholder="₱0.00"
                              className="flex-1 w-[40%] border border-gray-300 px-2 py-1 rounded text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 text-right"
                            />
                          </div>

                          <div className="flex items-center gap-4">
                            <label className="w-[60%] text-xs font-semibold text-gray-700">Remaining Skills Allowance:</label>
                            <input
                              id="skills_allowance_amount"
                              name="skills_allowance_amount"
                              type="text"
                              tabIndex={10}
                              value={formData.skills_allowance_amount}
                              placeholder="₱0.00"
                              onFocus={(e) => {
                                const raw = e.target.value.replace(/[^\d.]/g, ""); // strip peso, commas
                                setFormData((prev) => ({
                                  ...prev,
                                  skills_allowance_amount: raw,
                                }));
                              }}
                              onChange={(e) => {
                                const input = e.target.value.replace(/[^\d.]/g, ""); // only numbers + decimal
                                setFormData((prev) => ({
                                  ...prev,
                                  skills_allowance_amount: input,
                                }));
                              }}
                              onBlur={(e) => {
                                const number = parseFloat(e.target.value.replace(/[^\d.]/g, ""));
                                const formatted = !isNaN(number)
                                  ? "₱" + number.toLocaleString("en-PH", {
                                      minimumFractionDigits: 2,
                                      maximumFractionDigits: 2,
                                    })
                                  : "";
                                setFormData((prev) => ({
                                  ...prev,
                                  skills_allowance_amount: formatted,
                                }));
                              }}
                              className="flex-1 w-[40%] border border-gray-300 px-2 py-1 rounded text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 text-right"
                            />
                          </div>

                          <div className="flex items-center gap-4">
                            <label className="w-[60%] text-xs font-semibold text-gray-700">Adjustments:</label>
                            <input
                              id="adjustment_amount"
                              name="adjustment_amount"
                              type="text"
                              value={formData.adjustment_amount}
                              tabIndex={11}
                              onFocus={(e) => {
                                const raw = e.target.value.replace(/[^0-9.]/g, "");
                                setFormData((prev) => ({
                                  ...prev,
                                  adjustment_amount: raw,
                                }));
                              }}
                              onChange={(e) => {
                                const cleaned = e.target.value.replace(/[^0-9.]/g, "");
                                setFormData((prev) => ({
                                  ...prev,
                                  adjustment_amount: cleaned,
                                }));
                              }}
                              onBlur={(e) => {
                                const raw = parseFloat(e.target.value);
                                const formatted = !isNaN(raw)
                                  ? "₱" +
                                    raw.toLocaleString("en-PH", {
                                      minimumFractionDigits: 2,
                                      maximumFractionDigits: 2,
                                    })
                                  : "";
                                setFormData((prev) => ({
                                  ...prev,
                                  adjustment_amount: formatted,
                                }));
                              }}
                              placeholder="₱0.00"
                              className="flex-1 w-[40%] border border-gray-300 px-2 py-1 rounded text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 text-right"
                            />
                          </div>
                        </div>  
                      </div>  
                    </div>
                    
                    <div className="p-4">
                      <div className="flex items-center gap-4 py-1">
                        <label className="w-[75%] text-xs font-bold text-gray-700">Gross Amt Due to Employee:</label>
                        <input
                          id="other_due_to_employee"
                          name="other_due_to_employee"
                          type="text"
                          inputMode="decimal"
                          value={formData.other_due_to_employee}
                          readOnly
                          tabIndex={-1}
                          placeholder="₱0.00"
                          className="flex-1 border border-gray-300 p-1 rounded text-xs font-semibold bg-gray-100 cursor-not-allowed w-[25%] text-right"
                        />             
                      </div>
                  
                      <div className="flex items-center gap-4">
                        <label className="w-[75%] text-xs font-bold text-gray-700">Others:</label>
                        <input
                          id="others"
                          name="others"
                          type="text"
                          value={formData.others}
                          tabIndex={15}
                          onFocus={(e) => {
                            const raw = e.target.value.replace(/[^0-9.]/g, "");
                            setFormData((prev) => ({
                              ...prev,
                              others: raw,
                            }));
                          }}
                          onChange={(e) => {
                            const cleaned = e.target.value.replace(/[^0-9.]/g, "");
                            setFormData((prev) => ({
                              ...prev,
                              others: cleaned,
                            }));
                          }}
                          onBlur={(e) => {
                            const raw = parseFloat(e.target.value);
                            const formatted = !isNaN(raw)
                              ? "₱" +
                                raw.toLocaleString("en-PH", {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })
                              : "";
                            setFormData((prev) => ({
                              ...prev,
                              others: formatted,
                            }));
                          }}
                          placeholder="₱0.00"
                          className="flex-1 w-[40%] border border-gray-300 px-2 py-1 rounded text-xs font-semibold  bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 text-right"
                        />
                      </div>

                      {toNumber(formData.tax_due_refund) < 0 && <TaxDueRefundRow />}

                      <div className="flex items-center gap-4 py-1">
                        <label className="w-[75%] text-xs font-bold text-gray-700">Gross Final Pay:</label>
                        <input
                          type="text"
                          inputMode="decimal"
                          readOnly
                          tabIndex={-1}
                          value={formatPhp(
                            parsePesoNumber(formData.other_due_to_employee) +
                            parsePesoNumber(formData.others) +
                            (parsePesoNumber(formData.tax_due_refund) < 0
                              ? Math.abs(parsePesoNumber(formData.tax_due_refund))
                              : 0)
                          )}
                          placeholder="₱0.00"
                          className="flex-1 border border-gray-300 p-1 rounded text-xs font-semibold bg-gray-100 cursor-not-allowed w-[25%] text-right"
                        />
                      </div>                    

                      <div className="flex items-center gap-4">
                        <label className="w-[60%] text-xs font-bold text-red-800 py-1">Less:</label>
                      </div>

                      {toNumber(formData.tax_due_refund) > 0 && <TaxDueRefundRow />}

                      <div className="flex items-center gap-4 py-1">
                        <label className="w-[75%] text-xs pl-10 font-bold text-red-800">Partial 13th Month Pay:</label>
                        <input
                          id="thirteenth_month_partial"
                          name="thirteenth_month_partial"
                          type="text"
                          value={formData.thirteenth_month_partial}
                          tabIndex={16}
                          onFocus={(e) => {
                            const raw = e.target.value.replace(/[^0-9.]/g, "");
                            setFormData((prev) => ({
                              ...prev,
                              thirteenth_month_partial: raw,
                            }));
                          }}
                          onChange={(e) => {
                            const cleaned = e.target.value.replace(/[^0-9.]/g, "");
                            setFormData((prev) => ({
                              ...prev,
                              thirteenth_month_partial: cleaned,
                            }));
                          }}
                          onBlur={(e) => {
                            const raw = Math.abs(parseFloat(e.target.value.replace(/[^0-9.]/g, "")));
                            const formatted = !isNaN(raw)
                              ? "₱" + raw.toLocaleString("en-PH", {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })
                              : "";
                            setFormData((prev) => ({
                              ...prev,
                              thirteenth_month_partial: formatted,
                            }));
                          }}
                          placeholder="₱0.00"
                          className="flex-1 w-[25%] border border-gray-300 px-2 py-1 rounded text-xs font-bold bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 text-right text-red-800"
                        />
                      </div>

                      <div className="flex items-center gap-4 py-1">
                        <label className="w-[75%] text-xs pl-10 font-bold text-red-800">Outstanding Company Loans:</label>
                        <input
                          id="outstanding_company_loans"
                          name="outstanding_company_loans"
                          type="text"
                          value={formData.outstanding_company_loans}
                          tabIndex={16}
                          onFocus={(e) => {
                            const raw = e.target.value.replace(/[^0-9.]/g, "");
                            setFormData((prev) => ({
                              ...prev,
                              outstanding_company_loans: raw,
                            }));
                          }}
                          onChange={(e) => {
                            const cleaned = e.target.value.replace(/[^0-9.]/g, "");
                            setFormData((prev) => ({
                              ...prev,
                              outstanding_company_loans: cleaned,
                            }));
                          }}
                          onBlur={(e) => {
                            const raw = Math.abs(parseFloat(e.target.value.replace(/[^0-9.]/g, "")));
                            const formatted = !isNaN(raw)
                              ? "₱" + raw.toLocaleString("en-PH", {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })
                              : "";
                            setFormData((prev) => ({
                              ...prev,
                              outstanding_company_loans: formatted,
                            }));
                          }}
                          placeholder="₱0.00"
                          className="flex-1 w-[25%] border border-gray-300 px-2 py-1 rounded text-xs font-bold bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 text-right text-red-800"
                        />
                      </div>

                      <div className="flex items-center gap-4 py-1">
                        <label className="w-[75%] text-xs pl-10 font-bold text-red-800">Other Accountabilities:</label>
                        <input
                          id="other_accountabilities"
                          name="other_accountabilities"
                          type="text"
                          value={formData.other_accountabilities}
                          tabIndex={17}
                          onFocus={(e) => {
                            const raw = e.target.value.replace(/[^0-9.]/g, "");
                            setFormData((prev) => ({
                              ...prev,
                              other_accountabilities: raw,
                            }));
                          }}
                          onChange={(e) => {
                            const cleaned = e.target.value.replace(/[^0-9.]/g, "");
                            setFormData((prev) => ({
                              ...prev,
                              other_accountabilities: cleaned,
                            }));
                          }}
                          onBlur={(e) => {
                            const raw = Math.abs(parseFloat(e.target.value.replace(/[^0-9.]/g, "")));
                            const formatted = !isNaN(raw)
                              ? "₱" + raw.toLocaleString("en-PH", {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })
                              : "";
                            setFormData((prev) => ({
                              ...prev,
                              other_accountabilities: formatted,
                            }));
                          }}
                          placeholder="₱0.00"
                          className="flex-1 w-[25%] border border-gray-300 px-2 py-1 font-bold rounded text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 text-right text-red-800"
                        />
                      </div>

                      {(() => {
                        const raw = toNumber(formData.total_final_pay);
                        const isNegative = raw < 0;

                        const formattedValue = isNegative
                          ? `(₱${Math.abs(raw).toLocaleString("en-PH", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })})`
                          : `₱${raw.toLocaleString("en-PH", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}`;

                        return (
                          <div className="flex items-center gap-4 py-1">
                            <label className="w-[75%] text-xs font-bold text-gray-700">
                              Net Final Pay:
                            </label>

                            <input
                              id="total_final_pay"
                              name="total_final_pay"
                              type="text"
                              readOnly
                              tabIndex={-1}
                              value={formattedValue}
                              placeholder="₱0.00"
                              className={`flex-1 border p-1 rounded text-xs font-bold bg-gray-100 cursor-not-allowed w-[25%] text-right ${
                                isNegative ? "text-red-700 border-red-400" : "text-gray-800 border-gray-300"
                              }`}
                            />
                          </div>
                        );
                      })()}
                    </div>
                  </div>

                  <div className="text-sm border-2 rounded p-2">
                    <div className="text-xs font-bold text-gray-600 uppercase mb-2">
                      Calculation Summary
                    </div>
                    <div className="grid gap-x-10 gap-y-3 p-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-4">
                          <label className="w-[60%] text-xs font-semibold text-gray-700">YTD Gross Compensation:</label>
                          <input
                            id="ytd_gross_compensation"
                            name="ytd_gross_compensation"
                            type="text"
                            inputMode="decimal"
                            value={formData.ytd_gross_compensation}
                            readOnly
                            tabIndex={-1}
                            placeholder="₱0.00"
                            className="flex-1 border border-gray-300 p-1 rounded text-xs bg-gray-100 cursor-not-allowed text-right"
                          />
                        </div>
                        <div className="flex items-center gap-4">
                          <label className="w-[60%] pl-6 text-xs font-semibold text-gray-700">Less:</label>
                        </div>

                        <div className="flex items-center gap-4">
                          <label className="w-[60%] pl-14 text-xs font-semibold text-gray-700">Non Taxable 13th Month Pay:</label>
                          <input
                            id="thirteenth_month_capped"
                            name="thirteenth_month_capped"
                            type="text"
                            tabIndex={12}
                            value={formData.thirteenth_month_capped}
                            onFocus={(e) => {
                              const raw = e.target.value.replace(/[^0-9.]/g, "");
                              setFormData((prev) => ({
                                ...prev,
                                thirteenth_month_capped: raw,
                              }));
                            }}
                            onChange={(e) => {
                              const cleaned = e.target.value.replace(/[^0-9.]/g, "");
                              setFormData((prev) => ({
                                ...prev,
                                thirteenth_month_capped: cleaned,
                              }));
                            }}
                            onBlur={(e) => {
                              const raw = parseFloat(e.target.value);
                              const formatted = !isNaN(raw)
                                ? "₱" +
                                  raw.toLocaleString("en-PH", {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  })
                                : "";
                              setFormData((prev) => ({
                                ...prev,
                                thirteenth_month_capped: formatted,
                              }));
                            }}
                            placeholder="₱0.00"
                            className="flex-1 w-[40%] border border-gray-300 px-2 py-1 rounded text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 text-right"
                          />
                        </div>

                        <div className="flex items-center gap-4">
                          <label className="w-[60%] pl-14 text-xs font-semibold text-gray-700">SSS / PHIC / HDMF:</label>
                          <input
                            id="sss_phic_hdmf"
                            name="sss_phic_hdmf"
                            type="text"
                            tabIndex={13}
                            value={formData.sss_phic_hdmf}
                            onFocus={(e) => {
                              const raw = e.target.value.replace(/[^0-9.]/g, "");
                              setFormData((prev) => ({
                                ...prev,
                                sss_phic_hdmf: raw,
                              }));
                            }}
                            onChange={(e) => {
                              const cleaned = e.target.value.replace(/[^0-9.]/g, "");
                              setFormData((prev) => ({
                                ...prev,
                                sss_phic_hdmf: cleaned,
                              }));
                            }}
                            onBlur={(e) => {
                              const raw = parseFloat(e.target.value);
                              const formatted = !isNaN(raw)
                                ? "₱" +
                                  raw.toLocaleString("en-PH", {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  })
                                : "";
                              setFormData((prev) => ({
                                ...prev,
                                sss_phic_hdmf: formatted,
                              }));
                            }}
                            placeholder="₱0.00"
                            className="flex-1 w-[40%] border border-gray-300 px-2 py-1 rounded text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 text-right"
                          />
                        </div>
                        <div className="flex items-center gap-4">
                          <label className="w-[60%] text-xs pl-14 font-semibold text-gray-700">Skills Allowance:</label>
                          <input
                            id="skills_allowance_total"
                            name="skills_allowance_total"
                            type="text"
                            inputMode="decimal"
                            value={formData.skills_allowance_total}
                            readOnly
                            tabIndex={-1}
                            placeholder="₱0.00"
                            className="flex-1 border border-gray-300 p-1 rounded text-xs bg-gray-100 cursor-not-allowed w-[40%] text-right"
                          />
                        </div>
                        <div className="flex items-center gap-4">
                          <label className="w-[60%] text-xs pl-14 font-semibold text-gray-700">Consumed SL/VL:</label>
                          <input
                            id="remaining_vl_pay"
                            name="remaining_vl_pay"
                            type="text"
                            inputMode="decimal"
                            value={formData.remaining_vl_pay}
                            readOnly
                            tabIndex={-1}
                            placeholder="₱0.00"
                            className="flex-1 border border-gray-300 p-1 rounded text-xs bg-gray-100 cursor-not-allowed w-[40%] text-right"
                          />
                        </div>
                        <div className="flex items-center gap-4">
                          <label className="w-[60%] text-xs pl-14 font-semibold text-gray-700">Other Non Taxable Compensation:</label>
                          <input
                            id="other_non_tax_compensation"
                            name="other_non_tax_compensation"
                            type="text"
                            tabIndex={14}
                            value={formData.other_non_tax_compensation}
                            onFocus={(e) => {
                              const raw = e.target.value.replace(/[^0-9.]/g, "");
                              setFormData((prev) => ({
                                ...prev,
                                other_non_tax_compensation: raw,
                              }));
                            }}
                            onChange={(e) => {
                              const cleaned = e.target.value.replace(/[^0-9.]/g, "");
                              setFormData((prev) => ({
                                ...prev,
                                other_non_tax_compensation: cleaned,
                              }));
                            }}
                            onBlur={(e) => {
                              const raw = parseFloat(e.target.value);
                              const formatted = !isNaN(raw)
                                ? "₱" +
                                  raw.toLocaleString("en-PH", {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  })
                                : "";
                              setFormData((prev) => ({
                                ...prev,
                                other_non_tax_compensation: formatted,
                              }));
                            }}
                            placeholder="₱0.00"
                            className="flex-1 w-[40%] border border-gray-300 px-2 py-1 rounded text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 text-right"
                          />
                        </div>

                        <div className="flex items-center gap-4">
                          <label className="w-[60%] pl-6 text-xs font-semibold text-gray-700">Total Non Taxable Compensation:</label>
                          <input
                            id="less_non_taxable_comp"
                            name="less_non_taxable_comp"
                            type="text"
                            inputMode="decimal"
                            value={formData.less_non_taxable_comp}
                            readOnly
                            tabIndex={-1}
                            placeholder="₱0.00"
                            className="flex-1 border border-gray-300 p-1 rounded text-xs bg-gray-100 cursor-not-allowed text-right"
                          />
                        </div>
                        <div className="h-4" />
                        <div className="flex items-center gap-4">
                          <label className="w-[60%] text-xs font-semibold text-gray-700">Net Taxable Income:</label>
                          <input
                            id="net_taxable_income"
                            name="net_taxable_income"
                            type="text"
                            inputMode="decimal"
                            value={formData.net_taxable_income}
                            readOnly
                            tabIndex={-1}
                            placeholder="₱0.00"
                            className="flex-1 border border-gray-300 p-1 rounded text-xs bg-gray-100 cursor-not-allowed text-right"
                          />
                        </div>
                        <div className="flex items-center gap-4">
                          <label className="w-[60%] text-xs font-semibold text-gray-700">Tax Due:</label>
                          <input
                            id="tax_due"
                            name="tax_due"
                            type="text"
                            inputMode="decimal"
                            value={formData.tax_due}
                            readOnly
                            tabIndex={-1}
                            placeholder="₱0.00"
                            className="flex-1 border border-gray-300 p-1 rounded text-xs bg-gray-100 cursor-not-allowed text-right"
                          />
                        </div>
                        <div className="flex items-center gap-4">
                          <label className="w-[60%] text-xs font-semibold text-gray-700">Tax Deduction to Date:</label>
                          <input
                            id="total_withholding_tax_deductions"
                            name="total_withholding_tax_deductions"
                            type="text"
                            inputMode="decimal"
                            value={formData.total_withholding_tax_deductions}
                            readOnly
                            tabIndex={-1}
                            placeholder="₱0.00"
                            className="flex-1 border border-gray-300 p-1 rounded text-xs bg-gray-100 cursor-not-allowed text-right"
                          />
                        </div>

                        {(() => {
                          const val = toNumber(formData.tax_due_refund);
                          const isDue = val > 0;
                          const isRefund = val < 0;

                          return (
                            <div className="flex items-center gap-4">
                              <label
                                className={`w-[60%] text-xs font-semibold ${
                                  isDue
                                    ? "text-red-600"
                                    : isRefund
                                    ? "text-green-600"
                                    : "text-gray-700"
                                }`}
                              >
                                {isDue
                                  ? "Tax Due:"
                                  : isRefund
                                  ? "Tax Refund:"
                                  : "Tax Due / Refund:"}
                              </label>

                              <input
                                id="tax_due_refund"
                                name="tax_due_refund"
                                type="text"
                                readOnly
                                tabIndex={-1}
                                value={
                                  "₱" +
                                  Math.abs(val).toLocaleString("en-PH", {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  })
                                }
                                placeholder="₱0.00"
                                className={`flex-1 border p-1 rounded text-xs bg-gray-100 cursor-not-allowed text-right font-semibold ${
                                  isDue
                                    ? "border-red-400 text-red-600"
                                    : isRefund
                                    ? "border-green-400 text-green-600"
                                    : "border-gray-300 text-gray-700"
                                }`}
                              />
                            </div>
                          );
                        })()}
                     </div>  
                    </div>  
                  </div>
                </div>

                <div className="flex justify-end items-center gap-4 mt-4">
                {isSaveDisabled && (
                  <p className="text-xs text-red-500 mt-1 text-right">
                    Please fill out all required fields before saving.
                  </p>
                )}
                  <button
                    onClick={handleSave}
                    disabled={isSaveDisabled}
                    tabIndex={18}
                    className={`w-[200px] text-white py-2 rounded transition ${
                      isSaveDisabled
                        ? "bg-blue-300 cursor-not-allowed"
                        : "bg-blue-600 hover:bg-blue-700"
                    }`}
                  >
                    Save Final Pay
                  </button>

                  <button
                    onClick={() => {
                      setSelectedEmployee(null);
                      setSearchQuery("");
                      resetForm();
                    }}
                    tabIndex={19}
                    className="w-[200px] bg-gray-200 text-gray-800 py-2 rounded hover:bg-gray-300"
                  >
                    Clear Selection
                  </button>
                </div>
                {/* NOTE: add the rest of your fields as more FormInput/FormDate/FormTextarea blocks */}
              </div>
            ) : (
              <p className="text-gray-500">
                {loading
                  ? "Loading..."
                  : selectedEmployee
                  ? "No payroll data found."
                  : "Select an employee to process final pay."}
              </p>
            )}
          </div>
        </section>
      </main>

      {showConfirmation && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div
            className={`bg-white w-[320px] rounded-lg shadow-lg p-6 text-center transform transition-all duration-300 scale-100 border-t-4 ${
              confirmationType === "success" ? "border-green-500" : "border-red-500"
            }`}
          >
            {/* Animated Icon */}
            <div
              className={`text-6xl mb-3 ${
                confirmationType === "success" ? "text-green-500" : "text-red-500"
              } animate-bounce3x`}
              style={{ animationIterationCount: 3 }}
            >
              {confirmationType === "success" ? "✅" : "❌"}
            </div>

            {/* Message */}
            <p className="text-sm text-gray-700 mb-4">{confirmationMessage}</p>

            {/* OK Button */}
            <button
              onClick={() => setShowConfirmation(false)}
              className={`px-4 py-2 text-sm font-medium text-white rounded ${
                confirmationType === "success"
                  ? "bg-green-600 hover:bg-green-700"
                  : "bg-red-600 hover:bg-red-700"
              }`}
            >
              OK
            </button>
          </div>
        </div>
      )}



    </div>
  );
};

export default ProcessFinalPay;
