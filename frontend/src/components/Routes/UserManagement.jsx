// src/components/Routes/QADashboardPage.jsx
import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import AppHeader from "../common/AppHeader";
import axios from "axios";
import { SERVER_URL } from "../lib/constants";
import "react-datepicker/dist/react-datepicker.css";

const UserManagement = () => {
  const navigate = useNavigate();
  const [userid, setUserId] = useState("");
  const [userName, setUserName] = useState("");
  // const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isManageModalOpen, setIsManageModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [rows, setRows] = useState([]);
  const [filteredRows, setFilteredRows] = useState([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [sortConfig, setSortConfig] = useState({
    key: null,
    direction: "asc",
  });

  const handleSort = (key) => {
    setSortConfig((prev) => {
      if (prev.key === key) {
        // toggle direction
        return {
          key,
          direction: prev.direction === "asc" ? "desc" : "asc",
        };
      }
      // new column → default asc
      return { key, direction: "asc" };
    });
  };

  const sortedRows = React.useMemo(() => {
    if (!Array.isArray(filteredRows)) return [];

    if (!sortConfig.key) return filteredRows;

    return [...filteredRows].sort((a, b) => {
      const valA = a[sortConfig.key] ?? "";
      const valB = b[sortConfig.key] ?? "";

      // date sort
      if (sortConfig.key === "user_registration_date") {
        return sortConfig.direction === "asc"
          ? new Date(valA) - new Date(valB)
          : new Date(valB) - new Date(valA);
      }

      // string / number sort
      return sortConfig.direction === "asc"
        ? valA.toString().localeCompare(valB.toString(), undefined, {
            numeric: true,
            sensitivity: "base",
          })
        : valB.toString().localeCompare(valA.toString(), undefined, {
            numeric: true,
            sensitivity: "base",
          });
    });
  }, [filteredRows, sortConfig]);

  const SortIcon = ({ column }) => {
    if (sortConfig.key !== column) return null;
    return sortConfig.direction === "asc" ? " ▲" : " ▼";
  };

  const [newUser, setNewUser] = useState({
    empId: "",
    user_email: "",
    user_first_name: "",
    user_last_name: "",
    user_access_level: "QA",
  });


  const tableRef = useRef(null);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const res = await axios.get(`${SERVER_URL}/api/getAppUsers`);

        // 🔒 SAFETY: normalize response
        const users = Array.isArray(res.data)
          ? res.data
          : Array.isArray(res.data.data)
          ? res.data.data
          : [];

        setRows(users);
        setFilteredRows(users);
      } catch (err) {
        console.error("Failed to fetch app users:", err);
        setRows([]);
        setFilteredRows([]);
      }
    };

    fetchUsers();
  }, []);


  useEffect(() => {
  if (!searchQuery) {
      setFilteredRows(rows);
      return;
  }

  const q = searchQuery.toLowerCase();

  const filtered = rows.filter((row) =>
      Object.values(row).some(
      (val) =>
          val &&
          val.toString().toLowerCase().includes(q)
      )
  );

  setFilteredRows(filtered);
  }, [searchQuery, rows]);

  const handleAddUser = async () => {
  try {
    await axios.post(`${SERVER_URL}/api/addAppUser`, newUser);

    setIsAddModalOpen(false);
    setNewUser({
      empId: "",
      user_email: "",
      user_first_name: "",
      user_last_name: "",
      user_access_level: "",
    });

    // Refresh table
    const res = await axios.get(`${SERVER_URL}/api/getAppUsers`);
    const users = Array.isArray(res.data) ? res.data : res.data.data;
    setRows(users);
    setFilteredRows(users);
  } catch (err) {
    console.error("Add user failed:", err);
    alert("Failed to add user");
  }
};

const isAddUserValid =
  newUser.empId.trim() &&
  newUser.user_email.trim() &&
  newUser.user_first_name.trim() &&
  newUser.user_last_name.trim() &&
  newUser.user_access_level.trim();

  






  return (
    <div className="h-screen overflow-hidden bg-[#f5f7fa] flex flex-col">
      <AppHeader />

      <main className="flex-1 flex overflow-hidden">
        {/* Sidebar Filter Panel */}
        <aside className="w-64 border-r border-gray-200 bg-white/80 p-4 space-y-4">
          <input
            type="text"
            placeholder="Advanced Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
          />

          <button
            onClick={() => {
              setSearchQuery("");
              setFilteredRows(rows); // reset to all
            }}
            className="w-full bg-gray-200 hover:bg-gray-300 text-sm py-2 rounded text-gray-700"
          >
            Clear Search
          </button>

            <button
              className="w-full mt-2 bg-blue-300 hover:bg-blue-400 text-sm py-2 rounded text-gray-700"
              onClick={() => setIsAddModalOpen(true)}
            >
              Add User
            </button>
        </aside>

        {/* Main Content */}
        <section className="flex-1 flex flex-col px-5 py-4 space-y-4 overflow-hidden">
        

        {/* User Table */}
        <div className="overflow-auto bg-white shadow-md rounded-lg">
          <table
            ref={tableRef}
            className="min-w-full border-collapse text-sm"
          >
            <thead className="bg-gray-200 sticky top-0 z-10">
              <tr>
                <th
                  onClick={() => handleSort("empId")}
                  className="px-3 py-2 border text-left cursor-pointer hover:bg-gray-300"
                >
                  Emp ID<SortIcon column="empId" />
                </th>

                <th
                  onClick={() => handleSort("user_email")}
                  className="px-3 py-2 border text-left cursor-pointer hover:bg-gray-300"
                >
                  Email<SortIcon column="user_email" />
                </th>

                <th
                  onClick={() => handleSort("user_last_name")}
                  className="px-3 py-2 border text-left cursor-pointer hover:bg-gray-300"
                >
                  Last Name<SortIcon column="user_last_name" />
                </th>

                <th
                  onClick={() => handleSort("user_first_name")}
                  className="px-3 py-2 border text-left cursor-pointer hover:bg-gray-300"
                >
                  First Name<SortIcon column="user_first_name" />
                </th>

                <th
                  onClick={() => handleSort("user_full_name")}
                  className="px-3 py-2 border text-left cursor-pointer hover:bg-gray-300"
                >
                  Full Name<SortIcon column="user_full_name" />
                </th>

                <th
                  onClick={() => handleSort("user_access_level")}
                  className="px-3 py-2 border text-left cursor-pointer hover:bg-gray-300"
                >
                  Access Level<SortIcon column="user_access_level" />
                </th>

                <th
                  onClick={() => handleSort("user_status")}
                  className="px-3 py-2 border text-left cursor-pointer hover:bg-gray-300"
                >
                  Status<SortIcon column="user_status" />
                </th>

                <th
                  onClick={() => handleSort("user_registration_date")}
                  className="px-3 py-2 border text-left cursor-pointer hover:bg-gray-300"
                >
                  Registered<SortIcon column="user_registration_date" />
                </th>
              </tr>
            </thead>

            <tbody>
              {filteredRows.length === 0 ? (
                <tr>
                  <td
                    colSpan="8"
                    className="text-center py-6 text-gray-500"
                  >
                    No users found
                  </td>
                </tr>
              ) : (
                sortedRows.map((row, idx) => (
                  <tr
                    key={idx}
                    onDoubleClick={() => {
                      setSelectedUser(row);
                      setIsManageModalOpen(true);
                    }}
                    title="Double Click to Manage User"
                    className="hover:bg-blue-50 cursor-pointer"
                  >
                    <td className="px-3 py-2 border">{row.empId}</td>
                    <td className="px-3 py-2 border">{row.user_email}</td>
                    <td className="px-3 py-2 border">{row.user_last_name}</td>
                    <td className="px-3 py-2 border">{row.user_first_name}</td>
                    <td className="px-3 py-2 border">{row.user_full_name}</td>
                    <td className="px-3 py-2 border">{row.user_access_level}</td>
                    <td className="px-3 py-2 border">
                      <span
                        className={`px-2 py-1 rounded text-xs font-semibold ${
                          row.user_status === "Active"
                            ? "bg-green-100 text-green-700"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        {row.user_status}
                      </span>
                    </td>
                    <td className="px-3 py-2 border">
                      {row.user_registration_date
                        ? new Date(row.user_registration_date).toLocaleDateString()
                        : ""}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        </section>
     </main>

     {isAddModalOpen && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
        <div className="bg-white w-[420px] rounded-lg shadow-lg p-5 space-y-4">
          <h2 className="text-lg font-semibold">Add New User</h2>

          <input
            type="text"
            placeholder="Employee ID"
            value={newUser.empId}
            onChange={(e) => setNewUser({ ...newUser, empId: e.target.value })}
            className="w-full border px-3 py-2 rounded text-sm"
          />

          <input
            type="email"
            placeholder="Email"
            value={newUser.user_email}
            onChange={(e) =>
              setNewUser({ ...newUser, user_email: e.target.value })
            }
            className="w-full border px-3 py-2 rounded text-sm"
          />

          <input
            type="text"
            placeholder="First Name"
            value={newUser.user_first_name}
            onChange={(e) =>
              setNewUser({ ...newUser, user_first_name: e.target.value })
            }
            className="w-full border px-3 py-2 rounded text-sm"
          />

          <input
            type="text"
            placeholder="Last Name"
            value={newUser.user_last_name}
            onChange={(e) =>
              setNewUser({ ...newUser, user_last_name: e.target.value })
            }
            className="w-full border px-3 py-2 rounded text-sm"
          />

          <select
            value={newUser.user_access_level}
            onChange={(e) =>
              setNewUser({ ...newUser, user_access_level: e.target.value })
            }
            className="w-full border px-3 py-2 rounded text-sm"
          >
            <option value="Accounting Staff">Accounting Staff</option>
            <option value="Accounting Admin">Accounting Admin</option>
          </select>

          <div className="flex justify-end gap-2 pt-3">
            <button
              onClick={() => setIsAddModalOpen(false)}
              className="px-4 py-2 text-sm bg-gray-200 rounded"
            >
              Cancel
            </button>
            <button
              onClick={handleAddUser}
              disabled={!isAddUserValid}
              className={`px-4 py-2 text-sm rounded text-white transition
                ${
                  isAddUserValid
                    ? "bg-blue-600 hover:bg-blue-700"
                    : "bg-gray-400 cursor-not-allowed"
                }
              `}
            >
              Save
            </button>
          </div>
        </div>
      </div>
    )}

    {isManageModalOpen && selectedUser && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
        <div className="bg-white w-[520px] rounded-lg shadow-lg p-6 space-y-4">

          <h2 className="text-lg font-semibold text-[#003b5c]">
            Manage User
          </h2>

          {/* READ-ONLY FIELDS */}
          {[
            ["Employee ID", selectedUser.empId],
            ["Email", selectedUser.user_email],
            ["Full Name", selectedUser.user_full_name],
            ["Registered", selectedUser.user_registration_date
              ? new Date(selectedUser.user_registration_date).toLocaleDateString()
              : ""],
          ].map(([label, value]) => (
            <div key={label}>
              <label className="text-xs text-gray-600 block mb-1">{label}</label>
              <input
                value={value || ""}
                readOnly
                className="w-full px-3 py-2 rounded border bg-gray-100 text-sm text-gray-700"
              />
            </div>
          ))}

          {/* ACCESS LEVEL (EDITABLE) */}
          <div>
            <label className="text-xs text-gray-600 block mb-1">
              Access Level
            </label>
            <select
              value={selectedUser.user_access_level}
              onChange={(e) =>
                setSelectedUser({
                  ...selectedUser,
                  user_access_level: e.target.value,
                })
              }
              className="w-full border px-3 py-2 rounded text-sm"
            >
              <option value="Accounting Staff">Accounting Staff</option>
              <option value="Accounting Admin">Accounting Admin</option>
            </select>
          </div>

          {/* STATUS (EDITABLE) */}
          <div>
            <label className="text-xs text-gray-600 block mb-1">
              Status
            </label>
            <select
              value={selectedUser.user_status}
              onChange={(e) =>
                setSelectedUser({
                  ...selectedUser,
                  user_status: e.target.value,
                })
              }
              className="w-full border px-3 py-2 rounded text-sm"
            >
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>

          {/* ACTIONS */}
          <div className="flex justify-end gap-2 pt-4">
            <button
              onClick={() => setIsManageModalOpen(false)}
              className="px-4 py-2 text-sm bg-gray-200 rounded"
            >
              Cancel
            </button>

            <button
              onClick={async () => {
                try {
                  await axios.post(`${SERVER_URL}/api/updateAppUser`, {
                    empId: selectedUser.empId,
                    user_access_level: selectedUser.user_access_level,
                    user_status: selectedUser.user_status,
                  });

                  setIsManageModalOpen(false);

                  // Refresh table
                  const res = await axios.get(`${SERVER_URL}/api/getAppUsers`);
                  const users = Array.isArray(res.data) ? res.data : res.data.data;
                  setRows(users);
                  setFilteredRows(users);
                } catch (err) {
                  console.error("Update failed", err);
                  alert("Failed to update user");
                }
              }}
              className="px-4 py-2 text-sm bg-[#00a1c9] hover:bg-[#0084a4] text-white rounded"
            >
              Save Changes
            </button>
          </div>
        </div>
      </div>
    )}
    </div>
  );
};

export default UserManagement;
