import { useState, useMemo } from "react";
import {
  FaSearch,
  FaChevronLeft,
  FaChevronRight,
  FaSort,
  FaSortUp,
  FaSortDown,
  FaInbox,
} from "react-icons/fa";
import { Skeleton } from "./Loader";

function DataTable({
  columns = [],
  data = [],
  isLoading = false,
  searchable = true,
  searchPlaceholder = "Search records...",
  onSearch,
  searchValue: controlledSearchValue,
  filters,
  actions,
  pagination,
  emptyTitle = "No records found",
  emptySubtitle = "Try adjusting your filters or search criteria.",
  selectable = false,
  selectedRows = [],
  onSelectRow,
  onSelectAll,
  idField = "id",
}) {
  const [internalSearch, setInternalSearch] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });

  const searchValue =
    controlledSearchValue !== undefined ? controlledSearchValue : internalSearch;

  const handleSearchChange = (e) => {
    const val = e.target.value;
    if (onSearch) {
      onSearch(val);
    } else {
      setInternalSearch(val);
    }
  };

  const handleSort = (key) => {
    setSortConfig((prev) => {
      if (prev.key === key) {
        if (prev.direction === "asc") return { key, direction: "desc" };
        return { key: null, direction: "asc" };
      }
      return { key, direction: "asc" };
    });
  };

  // Client-side filtering if onSearch is not provided
  const filteredData = useMemo(() => {
    if (onSearch || !searchValue.trim()) return data;
    const lower = searchValue.toLowerCase();
    return data.filter((item) =>
      Object.values(item).some((val) =>
        val ? String(val).toLowerCase().includes(lower) : false
      )
    );
  }, [data, searchValue, onSearch]);

  // Client-side sorting
  const sortedData = useMemo(() => {
    if (!sortConfig.key) return filteredData;
    const sorted = [...filteredData].sort((a, b) => {
      const aVal = a[sortConfig.key];
      const bVal = b[sortConfig.key];

      if (aVal === bVal) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;

      if (typeof aVal === "number" && typeof bVal === "number") {
        return sortConfig.direction === "asc" ? aVal - bVal : bVal - aVal;
      }

      return sortConfig.direction === "asc"
        ? String(aVal).localeCompare(String(bVal))
        : String(bVal).localeCompare(String(aVal));
    });
    return sorted;
  }, [filteredData, sortConfig]);

  const allSelected =
    sortedData.length > 0 &&
    sortedData.every((row) => selectedRows.includes(row[idField]));

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      {/* Controls Bar: Search, Filters, Actions */}
      {(searchable || filters || actions) && (
        <div className="p-4 border-b border-gray-100 flex flex-col md:flex-row md:items-center md:justify-between gap-3 bg-gray-50/50">
          <div className="flex flex-1 flex-wrap items-center gap-3">
            {searchable && (
              <div className="relative min-w-[220px] max-w-sm flex-1">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                  <FaSearch className="text-xs" />
                </div>
                <input
                  type="text"
                  value={searchValue}
                  onChange={handleSearchChange}
                  placeholder={searchPlaceholder}
                  className="w-full pl-9 pr-4 py-2 text-sm bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                />
              </div>
            )}
            {filters}
          </div>

          {actions && (
            <div className="flex items-center gap-2 shrink-0">{actions}</div>
          )}
        </div>
      )}

      {/* Table Container */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[650px]">
          <thead>
            <tr className="bg-gray-50/80 border-b border-gray-200 text-xs font-semibold text-gray-600 uppercase tracking-wider">
              {selectable && (
                <th className="py-3.5 px-4 w-10">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={(e) =>
                      onSelectAll &&
                      onSelectAll(
                        e.target.checked
                          ? sortedData.map((r) => r[idField])
                          : []
                      )
                    }
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                </th>
              )}

              {columns.map((col, idx) => (
                <th
                  key={idx}
                  className={`py-3.5 px-4 ${col.className || ""}`}
                >
                  {col.sortable ? (
                    <button
                      type="button"
                      onClick={() => handleSort(col.accessor)}
                      className="inline-flex items-center gap-1.5 hover:text-gray-900 transition font-semibold"
                    >
                      <span>{col.header}</span>
                      {sortConfig.key === col.accessor ? (
                        sortConfig.direction === "asc" ? (
                          <FaSortUp className="text-blue-600" />
                        ) : (
                          <FaSortDown className="text-blue-600" />
                        )
                      ) : (
                        <FaSort className="text-gray-300" />
                      )}
                    </button>
                  ) : (
                    <span>{col.header}</span>
                  )}
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-100 text-sm text-gray-700">
            {isLoading ? (
              // Skeleton rows
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="animate-pulse">
                  {selectable && (
                    <td className="py-4 px-4">
                      <Skeleton className="h-4 w-4 rounded" />
                    </td>
                  )}
                  {columns.map((_, colIdx) => (
                    <td key={colIdx} className="py-4 px-4">
                      <Skeleton className="h-4 w-full rounded" />
                    </td>
                  ))}
                </tr>
              ))
            ) : sortedData.length === 0 ? (
              // Empty State
              <tr>
                <td
                  colSpan={columns.length + (selectable ? 1 : 0)}
                  className="py-14 text-center text-gray-500"
                >
                  <div className="flex flex-col items-center justify-center">
                    <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center text-gray-400 mb-3">
                      <FaInbox className="text-2xl" />
                    </div>
                    <p className="font-semibold text-gray-800 text-base">
                      {emptyTitle}
                    </p>
                    <p className="text-xs text-gray-400 mt-1 max-w-sm">
                      {emptySubtitle}
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              // Data Rows
              sortedData.map((row, rowIdx) => {
                const isSelected = selectedRows.includes(row[idField]);
                return (
                  <tr
                    key={row[idField] || rowIdx}
                    className={`hover:bg-blue-50/40 transition-colors ${
                      isSelected ? "bg-blue-50/60" : ""
                    }`}
                  >
                    {selectable && (
                      <td className="py-3.5 px-4">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) =>
                            onSelectRow &&
                            onSelectRow(row[idField], e.target.checked)
                          }
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                        />
                      </td>
                    )}

                    {columns.map((col, colIdx) => (
                      <td
                        key={colIdx}
                        className={`py-3.5 px-4 ${col.className || ""}`}
                      >
                        {col.render
                          ? col.render(row, rowIdx)
                          : row[col.accessor]}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Bar */}
      {pagination && (
        <div className="px-4 py-3 border-t border-gray-100 bg-gray-50/60 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-600">
          <div>
            Showing{" "}
            <span className="font-semibold text-gray-800">
              {Math.min(
                (pagination.page - 1) * (pagination.pageSize || 10) + 1,
                pagination.totalItems || 0
              )}
            </span>{" "}
            to{" "}
            <span className="font-semibold text-gray-800">
              {Math.min(
                pagination.page * (pagination.pageSize || 10),
                pagination.totalItems || 0
              )}
            </span>{" "}
            of{" "}
            <span className="font-semibold text-gray-800">
              {pagination.totalItems || 0}
            </span>{" "}
            entries
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => pagination.onPageChange(pagination.page - 1)}
              disabled={pagination.page <= 1}
              className="px-3 py-1.5 rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 transition"
            >
              <FaChevronLeft className="text-[10px]" />
              <span>Prev</span>
            </button>

            <span className="px-3 py-1 font-medium text-gray-700">
              Page {pagination.page} of {pagination.totalPages || 1}
            </span>

            <button
              onClick={() => pagination.onPageChange(pagination.page + 1)}
              disabled={pagination.page >= (pagination.totalPages || 1)}
              className="px-3 py-1.5 rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 transition"
            >
              <span>Next</span>
              <FaChevronRight className="text-[10px]" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default DataTable;
