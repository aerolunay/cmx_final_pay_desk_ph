import React, { useEffect, useState, useMemo, useRef } from "react";
import AppHeader from "../common/AppHeader";
import axios from "axios";
import { SERVER_URL } from "../lib/constants";
import { pythonSERVER_URL } from "../lib/constants";
import DatePicker from "react-datepicker";
import ViewFinalPayModal from "../Modals/ViewFinalPayModal";
import "react-datepicker/dist/react-datepicker.css";
import { Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  BarElement,
  LineElement,
  BarController,
  LineController,
  CategoryScale,
  LinearScale,
  PointElement,
  Tooltip,
  Legend,
} from "chart.js";


ChartJS.register(
  BarController,
  LineController,
  BarElement,
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend
);

const Home = () => {
  const [data, setData] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState(null);
  const [search, setSearch] = useState("");
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [showMonthlyModal, setShowMonthlyModal] = useState(false);
  const [showWeeklyModal, setShowWeeklyModal] = useState(false);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [appUsers, setAppUsers] = useState([]);
  const [sortConfig, setSortConfig] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [showPayslipModal, setShowPayslipModal] = useState(false);
  const [lastUploadDate, setLastUploadDate] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    fetchUsers();
    fetchFinalPayData();
    fetchLastUploadDate();
  }, []);

  useEffect(() => {
    filterData();
  }, [data, search, startDate, endDate]);


  const fetchUsers = async () => {
    try {
      const res = await axios.get(`${SERVER_URL}/api/getAppUsers`);
      const data = res.data?.data || [];
      setAppUsers(data);
    } catch (err) {
      console.error("Error fetching users", err);
    }
  };

  const fetchFinalPayData = async () => {
    try {
      const res = await axios.get(`${SERVER_URL}/api/finalPayData`);
      const data = res.data?.data || [];
      setData(data);
    } catch (err) {
      console.error("Error fetching final pay data", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchLastUploadDate = async () => {
    try {
      const res = await axios.get(`${SERVER_URL}/api/latest-upload-date`);
      if (res.data?.lastUploadDate) {
        setLastUploadDate(new Date(res.data.lastUploadDate));
      }
    } catch (err) {
      console.error("Failed to fetch last upload date", err);
    }
  };

  const filterData = () => {
    let result = Array.isArray(data) ? [...data] : [];

    if (search) {
      result = result.filter((r) =>
        Object.values(r).some((val) =>
          String(val).toLowerCase().includes(search.toLowerCase())
        )
      );
    }

    if (startDate && endDate) {
      const normalizedStart = new Date(startDate);
      normalizedStart.setHours(0, 0, 0, 0);

      const normalizedEnd = new Date(endDate);
      normalizedEnd.setHours(23, 59, 59, 999);

      result = result.filter((r) => {
        const processedDate = safeDate(r.processed_date);
        if (!processedDate) return false;
        return processedDate >= normalizedStart && processedDate <= normalizedEnd;

      });
    }

    setFiltered(result);
  };

  const safeDate = (v) => {
    if (!v) return null;
    const d = new Date(v);
    return isNaN(d) ? null : d;
  };

  const formatDate = (dateStr) => {
    const d = safeDate(dateStr);
    return d
      ? d.toLocaleDateString("en-US", {
          month: "2-digit",
          day: "2-digit",
          year: "numeric",
        })
      : "—";
  };

  const handleColumnSort = (key) => {
    setSortConfig((prevConfig) => {
      const existing = prevConfig.find((col) => col.key === key);
      const newDirection = existing?.direction === "asc" ? "desc" : "asc";
      
      return [{ key, direction: newDirection }];
    });
  };

  const sortedData = useMemo(() => {
    if (!sortConfig.length) return filtered;

    const sorted = [...filtered];

    sortConfig.forEach(({ key, direction }) => {
      sorted.sort((a, b) => {
        let aVal = a[key];
        let bVal = b[key];

        // ✅ SAFE DATE SORTING
        if (key.toLowerCase().includes("date")) {
          aVal = safeDate(aVal);
          bVal = safeDate(bVal);

          if (!aVal && !bVal) return 0;
          if (!aVal) return direction === "asc" ? 1 : -1;
          if (!bVal) return direction === "asc" ? -1 : 1;

          return direction === "asc" ? aVal - bVal : bVal - aVal;
        }

        // Numbers
          const aNum = Number(aVal);
          const bNum = Number(bVal);

          if (!Number.isNaN(aNum) && !Number.isNaN(bNum)) {
            return direction === "asc" ? aNum - bNum : bNum - aNum;
          }

        // Strings
        aVal = aVal?.toString() || "";
        bVal = bVal?.toString() || "";
        return direction === "asc"
          ? aVal.localeCompare(bVal, "en", { sensitivity: "base" })
          : bVal.localeCompare(aVal, "en", { sensitivity: "base" });
      });
    });

    return sorted;
  }, [filtered, sortConfig]);


  const averageTAT = useMemo(() => {
    if (!filtered.length) return "0.00";

    let validCount = 0;

    const totalDays = filtered.reduce((sum, item) => {
      const processedDate = safeDate(item.processed_date);
      const resignedDate = safeDate(item.date_resigned);

      if (!processedDate || !resignedDate) return sum;

      validCount++;
      return sum + (processedDate - resignedDate) / (1000 * 60 * 60 * 24);
    }, 0);

    return validCount ? (totalDays / validCount).toFixed(2) : "0.00";
  }, [filtered]);


  // Bar chart data: processed per month
    const getMonthlyProcessedData = () => {
    const end = endDate ? new Date(endDate.getTime()) : new Date();
    const start = new Date(end);
    start.setMonth(start.getMonth() - 2); // last 3 months (inclusive)

    // Strip time for accurate comparison
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);

    const monthKey = (dateStr) => {
      const d = new Date(dateStr);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    };

    const dataByMonth = {};

    filtered.forEach((item) => {
      const date = safeDate(item.processed_date);
      if (!date) return;

      if (date >= start && date <= end) {
        const key = monthKey(date);
        if (!dataByMonth[key]) {
          dataByMonth[key] = { count: 0, payout: 0 };
        }
        dataByMonth[key].count += 1;
        dataByMonth[key].payout += Number(item.total_final_pay || 0);
      }
    });


    // Ensure 3 months are always included in order
    const labels = [];
    const counts = [];
    const payouts = [];

    for (let i = 2; i >= 0; i--) {
      const d = new Date(end);
      d.setMonth(d.getMonth() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      labels.push(key);
      counts.push(dataByMonth[key]?.count || 0);
      payouts.push(Number(dataByMonth[key]?.payout) || 0);
    }

    return {
      labels,
      datasets: [
        {
          type: "bar",
          label: "Total Processed",
          data: counts,
          backgroundColor: "blue",
          yAxisID: "y",
          order: 2,
        },
        {
          type: "line",
          label: "Total Payout (₱)",
          data: payouts.map(v => Number.isFinite(v) ? v : 0),
          borderColor: "green",
          backgroundColor: "transparent",
          tension: 0.4,
          yAxisID: "y1",
          order: 1,
        },
      ],
    };
  };

  const getWeeklyProcessedData = (yearFilter = null, quarterFilter = null) => {
    const weeklyCounts = {};
    const payoutSums = {};

    const quarterMap = {
      Q1: [0, 1, 2],
      Q2: [3, 4, 5],
      Q3: [6, 7, 8],
      Q4: [9, 10, 11],
    };

    filtered.forEach((item) => {
      const date = safeDate(item.processed_date);
      if (!date) return;

      const year = date.getFullYear();
      const month = date.getMonth();

      if (yearFilter && year !== Number(yearFilter)) return;
      if (quarterFilter && !quarterMap[quarterFilter].includes(month)) return;

      const sunday = new Date(date);
      sunday.setDate(date.getDate() - date.getDay());
      sunday.setHours(0, 0, 0, 0);

      const saturday = new Date(sunday);
      saturday.setDate(sunday.getDate() + 6);

      const weekKey = `${sunday.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      })} - ${saturday.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      })}`;

      weeklyCounts[weekKey] = (weeklyCounts[weekKey] || 0) + 1;
      payoutSums[weekKey] =
        (payoutSums[weekKey] || 0) + (Number(item.total_final_pay) || 0);
    });

    let sortedWeeks = Object.keys(weeklyCounts).sort((a, b) => {
      const [aStart] = a.split(" - ");
      const [bStart] = b.split(" - ");
      return new Date(aStart) - new Date(bStart);
    });

    if (!yearFilter && !quarterFilter) {
      sortedWeeks = sortedWeeks.slice(-5);
    }

    return {
      labels: sortedWeeks,
      datasets: [
        {
          type: "bar",
          label: "Total Processed",
          data: sortedWeeks.map((week) => weeklyCounts[week]),
          backgroundColor: "#10b981",
          yAxisID: "y",
          order: 2,
        },
        {
          type: "line",
          label: "Total Payout (₱)",
          data: sortedWeeks.map((week) => payoutSums[week] || 0),
          borderColor: "#f59e0b",
          backgroundColor: "#f59e0b33",
          tension: 0.4,
          yAxisID: "y1",
          order: 1,
        },
      ],
    };
  };

  const getCurrentQuarter = () => {
    const month = new Date().getMonth(); // 0 = Jan, 11 = Dec
    if (month < 3) return "Q1";
    if (month < 6) return "Q2";
    if (month < 9) return "Q3";
    return "Q4";
  };

  const [selectedQuarter, setSelectedQuarter] = useState(getCurrentQuarter());

  const userMap = useMemo(() => {
    const map = {};
    appUsers.forEach((user) => {
      map[user.user_email] = user.user_full_name;
    });
    return map;
  }, [appUsers]);

  const handlePayrollUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 🚫 Validate filename
    if (!file.name.startsWith("Callmaxsol_YTD")) {
      setUploadStatus("invalid_filename");
      setUploading(true);
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    setUploading(true);
    setUploadStatus(null);

    try {
      const response = await axios.post(
        `${pythonSERVER_URL}/webhook/upload-excel`,
        formData,
        {
          headers: { "Content-Type": "multipart/form-data" },
        }
      );

      console.log("Upload success:", response.data);
      setUploadStatus("success");

      // Optional refresh calls (safe to keep)
      fetchFinalPayData();
      fetchLastUploadDate();

      // 🔁 Reload page after success (1.5s delay)
      setTimeout(() => {
        window.location.reload();
      }, 1500);

    } catch (error) {
      console.error("Upload error:", error?.response?.data || error.message);
      setUploadStatus("error");
    }
  };


  const isValidChartData = (chartData) =>
  chartData &&
  Array.isArray(chartData.labels) &&
  chartData.labels.length > 0 &&
  chartData.datasets.every(ds =>
    Array.isArray(ds.data) &&
    ds.data.every(v => Number.isFinite(v))
  );


  return (
    <div className="h-screen overflow-hidden bg-[#f5f7fa] flex flex-col">
      <AppHeader />

      <main className="flex-1 flex overflow-hidden">
        {/* Sidebar Filter Panel */}
        <aside className="w-64 border-r border-gray-200 bg-white/80 p-4 space-y-4">
          <div>
            <input
              type="text"
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-400 rounded focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="text-xs text-gray-600 mb-1 block">Processed Date</label>
            <div className="flex gap-2 mb-2">
              <DatePicker
                selected={startDate}
                onChange={(date) => setStartDate(date)}
                selectsStart
                startDate={startDate}
                endDate={endDate}
                placeholderText="Start date"
                className="w-full mb-2 px-3 py-2 text-sm border border-gray-400 rounded"
                popperPlacement="right-end"
              />
              <DatePicker
                selected={endDate}
                onChange={(date) => setEndDate(date)}
                selectsEnd
                startDate={startDate}
                endDate={endDate}
                minDate={startDate}
                placeholderText="End date"
                className="w-full px-3 py-2 text-sm border border-gray-400 rounded"
                popperPlacement="right-end"
              />
            </div>

            <button
              onClick={() => {
                setSearch("");
                setStartDate(null);
                setEndDate(null);
              }}
              className="w-full mt-2 bg-gray-300 hover:bg-gray-300 text-sm py-2 rounded font-semibold mb-6"
            >
              Clear Filters
            </button>
          </div> 

          <div className="mt-6 text-sm text-gray-600">
            <p>
              Last Payroll Data:{" "}
              <span className="font-medium text-black">
                {lastUploadDate ? lastUploadDate.toLocaleDateString("en-US") : "—"}
              </span>
            </p>

            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full mt-3 bg-gray-300 hover:bg-gray-400 text-sm py-2 rounded font-semibold text-black"
            >
              Upload New Payroll Data
            </button>

            <input
              type="file"
              accept=".xlsx, .xls"
              onChange={handlePayrollUpload}
              ref={fileInputRef}
              style={{ display: "none" }}
            />
          </div>
        </aside>

        {/* Main Content */}
        <section className="flex-1 flex flex-col px-5 py-4 space-y-4 overflow-hidden">
          {/* Top Cards + Chart Row */}
          <div className="flex gap-4 max-h-1/4">
            {/* Total Processed Card (1/3 width) */}
            <div className="w-1/6 bg-white rounded shadow p-4 border border-gray-200 flex flex-col">
              <div>
                <div className="text-sm font-semibold">Total Processed</div>
                <div className="text-[16px] font-semibold text-[#003b5c]">{filtered.length}</div>
              </div>
              <div className="mt-6">
                <div className="text-sm font-semibold">Total Payout</div>
                <div className="text-[16px] font-semibold text-[#003b5c]">
                  ₱{filtered.reduce((sum, item) => sum + (Number(item.total_final_pay) || 0), 0).toLocaleString()}
                </div>
              </div>
              <div className="mt-6">
                <div className="text-sm font-semibold">Average Processing TAT</div>
                <div className="text-[16px] font-semibold text-[#003b5c]">
                  {averageTAT} days
                </div>
              </div>
            </div>

            {/* Processed per Month Chart (2/3 width) */}
            <div className="w-1/3 bg-white rounded shadow p-4 border border-gray-200 flex flex-col"
                 onDoubleClick={() => setShowMonthlyModal(true)}
                 title="Double-click to open full view"
            >
              <h3 className="text-sm font-semibold mb-2">Processed per Month</h3>
              <div className="flex-1 min-h-0">
                {filtered.length > 0 && isValidChartData(getMonthlyProcessedData()) && (
                <Bar
                  data={getMonthlyProcessedData()}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: { position: "top" },
                    },
                    layout: { padding: 0 },
                    scales: {
                      y: {
                        beginAtZero: true,
                        position: "left",
                        title: {
                          display: true,
                          text: "Total Processed",
                        },
                        ticks: {
                          precision: 0,
                        },
                      },
                      y1: {
                        beginAtZero: true,
                        position: "right",
                        title: {
                          display: true,
                          text: "Total Payout (₱)",
                        },
                        grid: {
                          drawOnChartArea: false,
                        },
                        ticks: {
                          callback: function (value) {
                            if (value >= 1_000_000) return "₱" + (value / 1_000_000).toFixed(1) + "M";
                            if (value >= 1_000) return "₱" +  Math.round(value / 1_000) + "K";
                            return value;
                          },
                          color: "#000",
                        },
                      },
                    },
                  }}
                />
                )}
              </div>
            </div>

            {/* Processed per Week Chart (2/3 width) */}
            <div className="w-1/2 bg-white rounded shadow p-4 border border-gray-200 flex flex-col"
                 onDoubleClick={() => setShowWeeklyModal(true)}
                 title="Double-click to open full view"
            >
              <h3 className="text-sm font-semibold mb-2">Processed per Week</h3>
              <div className="flex-1 min-h-0">
                {filtered.length > 0 && isValidChartData(getWeeklyProcessedData()) && (
                <Bar
                  data={getWeeklyProcessedData()}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: { position: "top" },
                    },
                    layout: { padding: 0 },
                    scales: {
                      y: {
                        beginAtZero: true,
                        position: "left",
                        title: {
                          display: true,
                          text: "Total Processed",
                        },
                        ticks: { precision: 0 },
                      },
                      y1: {
                        beginAtZero: true,
                        position: "right",
                        title: {
                          display: true,
                          text: "Total Payout (₱)",
                        },
                        grid: {
                          drawOnChartArea: false,
                        },
                      },
                    },
                  }}
                />
                )}
              </div>
            </div>

          </div>

          {/* Data Table */}
          <div className="flex-1 overflow-y-auto rounded border bg-white">
            <table className="w-full text-sm">
              <thead className="bg-gray-300 sticky top-0">
                <tr>
                  <th
                    className="text-left p-2 cursor-pointer select-none"
                    onDoubleClick={() => handleColumnSort("empID")}
                    title="Double-click to sort"
                  >
                    Emp ID
                    {sortConfig.find((c) => c.key === "empID")?.direction === "asc" && " ↑"}
                    {sortConfig.find((c) => c.key === "empID")?.direction === "desc" && " ↓"}
                  </th>
                  <th
                    className="text-left p-2 cursor-pointer select-none"
                    onDoubleClick={() => handleColumnSort("Name")}
                    title="Double-click to sort"
                  >
                    Name 
                    {sortConfig.find((c) => c.key === "Name")?.direction === "asc" && " ↑"}
                    {sortConfig.find((c) => c.key === "Name")?.direction === "desc" && " ↓"}
                  </th>
                  <th
                    className="text-left p-2 cursor-pointer select-none"
                    onDoubleClick={() => handleColumnSort("position")}
                    title="Double-click to sort"
                  >
                    Position 
                    {sortConfig.find((c) => c.key === "position")?.direction === "asc" && " ↑"}
                    {sortConfig.find((c) => c.key === "position")?.direction === "desc" && " ↓"}
                  </th>
                  <th
                    className="text-left p-2 cursor-pointer select-none"
                    onDoubleClick={() => handleColumnSort("date_hired")}
                    title="Double-click to sort"
                  >
                    Hire Date
                    {sortConfig.find((c) => c.key === "date_hired")?.direction === "asc" && " ↑"}
                    {sortConfig.find((c) => c.key === "date_hired")?.direction === "desc" && " ↓"}
                  </th>
                  <th
                    className="text-left p-2 cursor-pointer select-none"
                    onDoubleClick={() => handleColumnSort("last_payout_cutoff")}
                    title="Double-click to sort"
                  >
                    Last Payout Cutoff
                    {sortConfig.find((c) => c.key === "last_payout_cutoff")?.direction === "asc" && " ↑"}
                    {sortConfig.find((c) => c.key === "last_payout_cutoff")?.direction === "desc" && " ↓"}
                  </th>
                  <th
                    className="text-left p-2 cursor-pointer select-none"
                    onDoubleClick={() => handleColumnSort("date_resigned")}
                    title="Double-click to sort"
                  >
                    Separation Date
                    {sortConfig.find((c) => c.key === "date_resigned")?.direction === "asc" && " ↑"}
                    {sortConfig.find((c) => c.key === "date_resigned")?.direction === "desc" && " ↓"}
                  </th>
                  <th
                    className="text-left p-2 cursor-pointer select-none"
                    onDoubleClick={() => handleColumnSort("processed_by")}
                    title="Double-click to sort"
                  >
                    Processed By
                    {sortConfig.find((c) => c.key === "processed_by")?.direction === "asc" && " ↑"}
                    {sortConfig.find((c) => c.key === "processed_by")?.direction === "desc" && " ↓"}
                  </th>
                  <th
                    className="text-left p-2 cursor-pointer select-none"
                    onDoubleClick={() => handleColumnSort("processed_date")}
                    title="Double-click to sort"
                  >
                    Date Processed
                    {sortConfig.find((c) => c.key === "processed_date")?.direction === "asc" && " ↑"}
                    {sortConfig.find((c) => c.key === "processed_date")?.direction === "desc" && " ↓"}
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedData.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="text-center text-gray-400 py-4">
                      No records found.
                    </td>
                  </tr>
                ) : (
                  sortedData.map((item, i) => (
                    <tr
                      key={i}
                      className="border-b hover:bg-blue-50 cursor-pointer"
                      onClick={() => {
                        setSelectedEmployee(item);
                        setShowPayslipModal(true);
                      }}
                    >
                      <td className="p-2">{item.empID}</td>
                      <td className="p-2">{item.Name}</td>
                      <td className="p-2">{item.position}</td>
                      <td className="p-2">{formatDate(item.date_hired)}</td>
                      <td className="p-2">{formatDate(item.last_payout_cutoff)}</td>
                      <td className="p-2">{formatDate(item.date_resigned)}</td>
                      <td className="p-2">
                        {userMap[item.processed_by] || item.processed_by}
                      </td>
                      <td className="p-2">{formatDate(item.processed_date)}</td>
                    </tr>
                  ))
                )}
              </tbody>

            </table>
          </div>
        </section>
      </main>

      {showMonthlyModal && (
        <div
          className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center"
          onClick={() => setShowMonthlyModal(false)}
        >
          <div
            className="bg-white border border-gray-200 shadow-2xl rounded-lg w-4/5 h-4/5 p-6 relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="absolute top-3 right-4 text-gray-500 text-2xl hover:text-red-500"
              onClick={() => setShowMonthlyModal(false)}
            >
              ×
            </button>
            <h2 className="text-lg font-semibold mb-4">Monthly Comparison</h2>

            <div className="mb-4">
              <label className="text-sm font-medium mr-2">Filter by Year:</label>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="border rounded px-2 py-1"
              >
                {Array.from({ length: 5 }).map((_, i) => {
                  const year = new Date().getFullYear() - i;
                  return <option key={year} value={year}>{year}</option>;
                })}
              </select>
            </div>

            <div className="h-[90%]">
              {filtered.length > 0 && isValidChartData(getMonthlyProcessedData()) && (
              <Bar
                data={getMonthlyProcessedData()}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: { position: "top" },
                    },
                    layout: { padding: 0 },
                    scales: {
                      y: {
                        beginAtZero: true,
                        position: "left",
                        title: {
                          display: true,
                          text: "Total Processed",
                        },
                        ticks: { precision: 0 },
                      },
                      y1: {
                        beginAtZero: true,
                        position: "right",
                        title: {
                          display: true,
                          text: "Total Payout (₱)",
                        },
                        grid: {
                          drawOnChartArea: false,
                        },
                      },
                    },
                  }}
              />
                )}
            </div>
          </div>
        </div>
      )}

      {showWeeklyModal && (
        <div
          className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center"
          onClick={() => setShowWeeklyModal(false)}
        >
          <div
            className="bg-white border border-gray-200 shadow-2xl rounded-lg w-4/5 h-4/5 p-6 relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="absolute top-3 right-4 text-gray-500 text-2xl hover:text-red-500"
              onClick={() => setShowWeeklyModal(false)}
            >
              ×
            </button>
            <h2 className="text-lg font-semibold mb-4">Weekly Comparison</h2>

            <div className="mb-4 flex gap-4 items-center">
              <div>
                <label className="text-sm font-medium mr-2">Year:</label>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                  className="border rounded px-2 py-1"
                >
                  {Array.from({ length: 5 }).map((_, i) => {
                    const year = new Date().getFullYear() - i;
                    return <option key={year} value={year}>{year}</option>;
                  })}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium mr-2">Quarter:</label>
                <select
                  value={selectedQuarter}
                  onChange={(e) => setSelectedQuarter(e.target.value)}
                  className="border rounded px-2 py-1"
                >
                  <option value="Q1">Q1</option>
                  <option value="Q2">Q2</option>
                  <option value="Q3">Q3</option>
                  <option value="Q4">Q4</option>
                </select>
              </div>
            </div>

            <div className="h-[90%]">
              {filtered.length > 0 && isValidChartData(getWeeklyProcessedData()) && (
              <Bar
                data={getWeeklyProcessedData(selectedYear, selectedQuarter)}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: { position: "top" },
                    },
                    layout: { padding: 0 },
                    scales: {
                      y: {
                        beginAtZero: true,
                        position: "left",
                        title: {
                          display: true,
                          text: "Total Processed",
                        },
                        ticks: { precision: 0 },
                      },
                      y1: {
                        beginAtZero: true,
                        position: "right",
                        title: {
                          display: true,
                          text: "Total Payout (₱)",
                        },
                        grid: {
                          drawOnChartArea: false,
                        },
                      },
                    },
                  }}
              />
              )}
            </div>
          </div>
        </div>
      )}
      
      {showPayslipModal && selectedEmployee && (
        <ViewFinalPayModal selectedEmployee={selectedEmployee} onClose={() => setShowPayslipModal(false)} />
      )}

      {uploading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-80 text-center space-y-4">
            {!uploadStatus ? (
              <>
                <div className="animate-spin h-10 w-10 mx-auto border-4 border-blue-500 border-t-transparent rounded-full"></div>
                <p className="text-gray-800 font-medium">Uploading Data...</p>
              </>
            ) : (
              <>
                <p className={`text-lg font-semibold ${
                  uploadStatus === "success" ? "text-green-600"
                  : uploadStatus === "invalid_filename" ? "text-yellow-600"
                  : "text-red-600"
                }`}>
                  {uploadStatus === "success" && "Payroll Data Updated"}
                  {uploadStatus === "error" && "Upload Failed, Please Try Again"}
                  {uploadStatus === "invalid_filename" && "Please upload the correct YTD Payroll file"}
                </p>
                <button
                  onClick={() => {
                    setUploading(false);
                    setUploadStatus(null);
                  }}
                  className="mt-4 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                >
                  OK
                </button>
              </>
            )}
          </div>
        </div>
      )}


    </div>
  );
};

export default Home;
