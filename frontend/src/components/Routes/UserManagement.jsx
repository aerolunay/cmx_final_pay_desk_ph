// src/components/Routes/UserManagement.jsx

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import AppHeader from "../common/AppHeader";
import axios from "axios";
import { SERVER_URL } from "../lib/constants";
import UserService from "../../service/UserService";
import "react-datepicker/dist/react-datepicker.css";

const ROLE_OPTIONS = ["Dev", "Accounting Admin"];

const emptyNewUser = {
  empId: "",
  user_email: "",
  user_first_name: "",
  user_last_name: "",
  user_access_level: "Accounting Admin",
};

const UserManagement = () => {
  const navigate = useNavigate();
  const tableRef = useRef(null);

  const [isManageModalOpen, setIsManageModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [rows, setRows] = useState([]);
  const [filteredRows, setFilteredRows] = useState([]);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newUser, setNewUser] = useState(emptyNewUser);

  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const [sortConfig, setSortConfig] = useState({
    key: null,
    direction: "asc",
  });

  const getAuthConfig = () => ({
    headers: {
      ...UserService.getAuthHeader(),
    },
  });

  const normalizeUsersResponse = (res) => {
    if (Array.isArray(res.data)) return res.data;
    if (Array.isArray(res.data?.data)) return res.data.data;
    return [];
  };

  const handleAuthError = (err) => {
    const status = err?.response?.status;

    if (status === 401) {
      UserService.logout();
      navigate("/OauthLogin", { replace: true });
      return true;
    }

    if (status === 403) {
      setMessage("You are not authorized to manage users.");
      return true;
    }

    return false;
  };

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setMessage("");

      const res = await axios.get(
        `${SERVER_URL}/api/getAppUsers`,
        getAuthConfig()
      );

      const users = normalizeUsersResponse(res);

      setRows(users);
      setFilteredRows(users);
    } catch (err) {
      if (handleAuthError(err)) return;

      console.error("Failed to fetch app users:", err);
      setRows([]);
      setFilteredRows([]);
      setMessage("Failed to fetch app users.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!UserService.isAuthenticated()) {
      navigate("/OauthLogin", { replace: true });
      return;
    }

    if (!UserService.canManageUsers?.()) {
      setMessage("You are not authorized to manage users.");
      setLoading(false);
      return;
    }

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
        (val) => val && val.toString().toLowerCase().includes(q)
      )
    );

    setFilteredRows(filtered);
  }, [searchQuery, rows]);

  const handleSort = (key) => {
    setSortConfig((prev) => {
      if (prev.key === key) {
        return {
          key,
          direction: prev.direction === "asc" ? "desc" : "asc",
        };
      }

      return { key, direction: "asc" };
    });
  };

  const sortedRows = useMemo(() => {
    if (!Array.isArray(filteredRows)) return [];
    if (!sortConfig.key) return filteredRows;

    return [...filteredRows].sort((a, b) => {
      const valA = a[sortConfig.key] ?? "";
      const valB = b[sortConfig.key] ?? "";

      if (sortConfig.key === "user_registration_date") {
        const dateA = new Date(valA);
        const dateB = new Date(valB);

        return sortConfig.direction === "asc"
          ? dateA - dateB
          : dateB - dateA;
      }

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

  const isAddUserValid =
    newUser.empId.trim() &&
    newUser.user_email.trim() &&
    newUser.user_first_name.trim() &&
    newUser.user_last_name.trim() &&
    newUser.user_access_level.trim();

  const handleAddUser = async () => {
    if (!isAddUserValid) return;

    try {
      setMessage("");

      await axios.post(
        `${SERVER_URL}/api/addAppUser`,
        {
          empId: newUser.empId.trim(),
          user_email: newUser.user_email.trim(),
          user_first_name: newUser.user_first_name.trim(),
          user_last_name: newUser.user_last_name.trim(),
          user_access_level: newUser.user_access_level.trim(),
        },
        getAuthConfig()
      );

      setIsAddModalOpen(false);
      setNewUser(emptyNewUser);
      await fetchUsers();
      setMessage("User added successfully.");
    } catch (err) {
      if (handleAuthError(err)) return;

      console.error("Add user failed:", err);
      setMessage(err?.response?.data?.error || "Failed to add user.");
    }
  };

  const handleUpdateUser = async () => {
    if (!selectedUser) return;

    try {
      setMessage("");

      await axios.post(
        `${SERVER_URL}/api/updateAppUser`,
        {
          empId: selectedUser.empId,
          user_access_level: selectedUser.user_access_level,
          user_status: selectedUser.user_status,
        },
        getAuthConfig()
      );

      setIsManageModalOpen(false);
      setSelectedUser(null);

      await fetchUsers();
      setMessage("User updated successfully.");
    } catch (err) {
      if (handleAuthError(err)) return;

      console.error("Update failed:", err);
      setMessage(err?.response?.data?.error || "Failed to update user.");
    }
  };

  return (
    <div className="h-screen overflow-hidden bg-[#f5f7fa] flex flex-col">
      <AppHeader />

      <main className="flex-1 flex overflow-hidden">
        <aside className="w-64 border-r border-gray-200 bg-white/80 p-4 space-y-4">
          <input
            type="text"
            placeholder="Advanced Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
          />

          <button
            type="button"
            onClick={() => {
              setSearchQuery("");
              setFilteredRows(rows);
            }}
            className="w-full bg-gray-200 hover:bg-gray-300 text-sm py-2 rounded text-gray-700"
          >
            Clear Search
          </button>

          <button
            type="button"
            className="w-full mt-2 bg-blue-300 hover:bg-blue-400 text-sm py-2 rounded text-gray-700"
            onClick={() => {
              setMessage("");
              setNewUser(emptyNewUser);
              setIsAddModalOpen(true);
            }}
          >
            Add User
          </button>

          {message && (
            <div className="text-xs text-gray-700 bg-gray-100 border rounded p-2">
              {message}
            </div>
          )}
        </aside>

        <section className="flex-1 flex flex-col px-5 py-4 space-y-4 overflow-hidden">
          <div className="overflow-auto bg-white shadow-md rounded-lg">
            <table ref={tableRef} className="min-w-full border-collapse text-sm">
              <thead className="bg-gray-200 sticky top-0 z-10">
                <tr>
                  <th
                    onClick={() => handleSort("empId")}
                    className="px-3 py-2 border text-left cursor-pointer hover:bg-gray-300"
                  >
                    Emp ID
                    <SortIcon column="empId" />
                  </th>

                  <th
                    onClick={() => handleSort("user_email")}
                    className="px-3 py-2 border text-left cursor-pointer hover:bg-gray-300"
                  >
                    Email
                    <SortIcon column="user_email" />
                  </th>

                  <th
                    onClick={() => handleSort("user_last_name")}
                    className="px-3 py-2 border text-left cursor-pointer hover:bg-gray-300"
                  >
                    Last Name
                    <SortIcon column="user_last_name" />
                  </th>

                  <th
                    onClick={() => handleSort("user_first_name")}
                    className="px-3 py-2 border text-left cursor-pointer hover:bg-gray-300"
                  >
                    First Name
                    <SortIcon column="user_first_name" />
                  </th>

                  <th
                    onClick={() => handleSort("user_full_name")}
                    className="px-3 py-2 border text-left cursor-pointer hover:bg-gray-300"
                  >
                    Full Name
                    <SortIcon column="user_full_name" />
                  </th>

                  <th
                    onClick={() => handleSort("user_access_level")}
                    className="px-3 py-2 border text-left cursor-pointer hover:bg-gray-300"
                  >
                    Access Level
                    <SortIcon column="user_access_level" />
                  </th>

                  <th
                    onClick={() => handleSort("user_status")}
                    className="px-3 py-2 border text-left cursor-pointer hover:bg-gray-300"
                  >
                    Status
                    <SortIcon column="user_status" />
                  </th>

                  <th
                    onClick={() => handleSort("user_registration_date")}
                    className="px-3 py-2 border text-left cursor-pointer hover:bg-gray-300"
                  >
                    Registered
                    <SortIcon column="user_registration_date" />
                  </th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="8" className="text-center py-6 text-gray-500">
                      Loading users...
                    </td>
                  </tr>
                ) : sortedRows.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="text-center py-6 text-gray-500">
                      No users found
                    </td>
                  </tr>
                ) : (
                  sortedRows.map((row, idx) => (
                    <tr
                      key={`${row.empId || "emp"}-${idx}`}
                      onDoubleClick={() => {
                        setSelectedUser(row);
                        setIsManageModalOpen(true);
                      }}
                      title="Double Click to Manage User"
                      className="hover:bg-blue-50 cursor-pointer"
                    >
                      <td className="px-3 py-2 border">{row.empId}</td>
                      <td className="px-3 py-2 border">{row.user_email}</td>
                      <td className="px-3 py-2 border">
                        {row.user_last_name}
                      </td>
                      <td className="px-3 py-2 border">
                        {row.user_first_name}
                      </td>
                      <td className="px-3 py-2 border">
                        {row.user_full_name}
                      </td>
                      <td className="px-3 py-2 border">
                        {row.user_access_level}
                      </td>
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
                          ? new Date(
                              row.user_registration_date
                            ).toLocaleDateString()
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
              onChange={(e) =>
                setNewUser({ ...newUser, empId: e.target.value })
              }
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
                setNewUser({
                  ...newUser,
                  user_first_name: e.target.value,
                })
              }
              className="w-full border px-3 py-2 rounded text-sm"
            />

            <input
              type="text"
              placeholder="Last Name"
              value={newUser.user_last_name}
              onChange={(e) =>
                setNewUser({
                  ...newUser,
                  user_last_name: e.target.value,
                })
              }
              className="w-full border px-3 py-2 rounded text-sm"
            />

            <select
              value={newUser.user_access_level}
              onChange={(e) =>
                setNewUser({
                  ...newUser,
                  user_access_level: e.target.value,
                })
              }
              className="w-full border px-3 py-2 rounded text-sm"
            >
              {ROLE_OPTIONS.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>

            <div className="flex justify-end gap-2 pt-3">
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="px-4 py-2 text-sm bg-gray-200 rounded"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleAddUser}
                disabled={!isAddUserValid}
                className={`px-4 py-2 text-sm rounded text-white transition ${
                  isAddUserValid
                    ? "bg-blue-600 hover:bg-blue-700"
                    : "bg-gray-400 cursor-not-allowed"
                }`}
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

            {[
              ["Employee ID", selectedUser.empId],
              ["Email", selectedUser.user_email],
              ["Full Name", selectedUser.user_full_name],
              [
                "Registered",
                selectedUser.user_registration_date
                  ? new Date(
                      selectedUser.user_registration_date
                    ).toLocaleDateString()
                  : "",
              ],
            ].map(([label, value]) => (
              <div key={label}>
                <label className="text-xs text-gray-600 block mb-1">
                  {label}
                </label>
                <input
                  value={value || ""}
                  readOnly
                  className="w-full px-3 py-2 rounded border bg-gray-100 text-sm text-gray-700"
                />
              </div>
            ))}

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
                {ROLE_OPTIONS.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs text-gray-600 block mb-1">Status</label>
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

            <div className="flex justify-end gap-2 pt-4">
              <button
                type="button"
                onClick={() => {
                  setIsManageModalOpen(false);
                  setSelectedUser(null);
                }}
                className="px-4 py-2 text-sm bg-gray-200 rounded"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleUpdateUser}
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