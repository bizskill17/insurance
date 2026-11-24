import { API_BASE } from "../config/api";
import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ActionIconDisplay } from "./ActionIcon";
import MultiSelectFilter from "./MultiSelectFilter";
import RecordDetailModal from "./RecordDetailModal";
import { Spinner } from "./Spinner";
import TablePagination from "./TablePagination";
import { downloadCsv, downloadPdf } from "../utils/export";
import { filterRecords, getRecordValue, sortRecords } from "../utils/dataView";
import { formatCellValue, formatCurrency } from "../utils/formatting";
import { renderCellText } from "./CellText";

const MIN_ACTION_COLUMN_WIDTH = 150;
// Left + right padding of a table cell, so the buttons do not touch the borders.
const ACTION_CELL_PADDING = 28;

function getColumnWidthStyle(column, fallback = "140px") {
  if (column.width) {
    return {
      width: column.width,
      minWidth: column.width,
      maxWidth: column.width
    };
  }

  const key = String(column.key || "").toLowerCase();
  const label = String(column.label || "").toLowerCase();
  const token = `${key} ${label}`;

  let width = fallback;

  if (token.includes("issue date") || token.includes("expiry date") || token.includes("follow up date")) {
    width = "120px";
  } else if (
    token.includes("policy no") ||
    token.includes("document no") ||
    token.includes("code") ||
    token.includes("mobile")
  ) {
    width = "110px";
  } else if (token.includes("customer group") || token.includes("group")) {
    width = "170px";
  } else if (
    token.includes("insurance company") ||
    token.includes("company")
  ) {
      width = "260px";
  } else if (token.includes("customer") || token.includes("agent")) {
    width = "145px";
  } else if (token.includes("product")) {
      width = "300px";
  } else if (
    token.includes("premium") ||
    token.includes("amount") ||
    token.includes("received") ||
    token.includes("pending")
  ) {
    width = "120px";
  } else if (
    token.includes("status") ||
    token.includes("active") ||
    token.includes("payment by") ||
    token.includes("payment mode") ||
    token.includes("policy type") ||
    token.includes("business type")
  ) {
    width = "110px";
  } else if (token.includes("remarks") || token.includes("description") || token.includes("notes")) {
    width = "260px";
  }

  return {
    width,
    minWidth: width,
    maxWidth: width
  };
}

function renderDocumentLinks(value) {
  const links = String(value || "")
    .split("||")
    .map((item) => item.trim())
    .filter(Boolean);

  if (!links.length) return "";

  return (
    <span className="document-links">
      {links.map((link, index) => (
        <a
          key={link}
          href={/^https?:\/\//i.test(link) ? link : `${API_BASE}/${link.replace(/^\/+/, "")}`}
          target="_blank"
          rel="noreferrer"
          className="text-blue"
        >
          {links.length === 1 ? "Link" : `Link ${index + 1}`}
        </a>
      ))}
    </span>
  );
}
export default function ResponsiveDataView({
  title,
  records,
  columns,
  loading,
  error,
  loadingMessage,
  emptyMessage,
  searchKeys,
  filterConfigs = [],
  renderActions,
  rowKey = "id",
  initialSort = null,
  headerExtras = null,
  customFilterContent = null,
  onClearCustomFilters = null,
  detailTitle = null,
  getDetailRows = null,
  loadDetailData = null,
  renderDetailExtra = null,
  // Optional grouping, e.g. by month: (record) => ({ key, label, order, sortValue }).
  // Rows are ordered by group `order`; inside a group by the chosen column sort, or by `sortValue`.
  groupBy = null,
  groupNoun = "records"
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [sortConfig, setSortConfig] = useState(initialSort);
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [detailData, setDetailData] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [activeFilters, setActiveFilters] = useState(() =>
    Object.fromEntries(filterConfigs.map((filter) => [filter.key, []]))
  );

  useEffect(() => {
    setActiveFilters(Object.fromEntries(filterConfigs.map((filter) => [filter.key, []])));
  }, [filterConfigs]);

  const filteredRecords = useMemo(
    () => filterRecords(records, { searchTerm, searchKeys, activeFilters }),
    [records, searchTerm, searchKeys, activeFilters]
  );

  const sortedRecords = useMemo(() => {
    const sorted = sortRecords(filteredRecords, sortConfig);
    if (!groupBy) {
      return sorted;
    }
    const withGroups = sorted.map((record, position) => ({ record, position, group: groupBy(record) }));
    withGroups.sort((left, right) => {
      if (left.group.order !== right.group.order) {
        return left.group.order < right.group.order ? -1 : 1;
      }
      if (!sortConfig && left.group.sortValue !== right.group.sortValue) {
        return String(left.group.sortValue || "") < String(right.group.sortValue || "") ? -1 : 1;
      }
      return left.position - right.position;
    });
    return withGroups.map((item) => item.record);
  }, [filteredRecords, sortConfig, groupBy]);

  // How many records each group has across all pages (shown in the group heading).
  const groupCounts = useMemo(() => {
    if (!groupBy) {
      return null;
    }
    const counts = new Map();
    sortedRecords.forEach((record) => {
      const { key } = groupBy(record);
      counts.set(key, (counts.get(key) || 0) + 1);
    });
    return counts;
  }, [sortedRecords, groupBy]);
  const totalPages = Math.max(1, Math.ceil(sortedRecords.length / pageSize));
  const pageStart = (currentPage - 1) * pageSize;
  const paginatedRecords = useMemo(
    () => sortedRecords.slice(pageStart, pageStart + pageSize),
    [pageSize, pageStart, sortedRecords]
  );

  // The table uses fixed column widths, so the Action column cannot grow by itself.
  // Measure the widest set of action buttons on this page and size the column to fit
  // (e.g. a task with an extra "assign" button needs four buttons, not three).
  const tableRef = useRef(null);
  const [actionColumnWidth, setActionColumnWidth] = useState(MIN_ACTION_COLUMN_WIDTH);

  useLayoutEffect(() => {
    if (!renderActions || !tableRef.current) {
      return;
    }

    const cells = tableRef.current.querySelectorAll("td.master-table__actions-cell > .table-actions");
    let widest = 0;
    cells.forEach((cell) => {
      widest = Math.max(widest, cell.scrollWidth);
    });

    const nextWidth = Math.max(MIN_ACTION_COLUMN_WIDTH, Math.ceil(widest) + ACTION_CELL_PADDING);
    setActionColumnWidth((current) => (current === nextWidth ? current : nextWidth));
  }, [paginatedRecords, renderActions]);

  const actionColumnStyle = {
    width: `${actionColumnWidth}px`,
    minWidth: `${actionColumnWidth}px`,
    maxWidth: `${actionColumnWidth}px`
  };

  useEffect(() => {
    setCurrentPage(1);
    setSearchTerm("");
    setActiveFilters(Object.fromEntries(filterConfigs.map((filter) => [filter.key, []])));
    setIsFiltersOpen(false);
  }, [title, filterConfigs]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, activeFilters, pageSize, records]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const handleSort = (key) => {
    setSortConfig((current) => {
      if (current?.key === key && current.direction === "asc") {
        return { key, direction: "desc" };
      }

      return { key, direction: "asc" };
    });
  };

  const detailRows = useMemo(() => {
    if (!selectedRecord) {
      return [];
    }

    if (getDetailRows) {
      return getDetailRows(selectedRecord, detailData);
    }

    return columns.map((column) => ({
      key: column.key,
      label: column.label,
      value:
        column.type === "document-links"
          ? renderDocumentLinks(getRecordValue(selectedRecord, column.key))
          : column.type === "currency"
          ? formatCurrency(getRecordValue(selectedRecord, column.key))
          : formatCellValue(getRecordValue(selectedRecord, column.key))
    }));
  }, [columns, detailData, getDetailRows, selectedRecord]);

  const handleRecordOpen = async (record) => {
    setSelectedRecord(record);
    setDetailData(null);
    setDetailError("");

    if (!loadDetailData) {
      setDetailLoading(false);
      return;
    }

    setDetailLoading(true);
    try {
      const loadedDetail = await loadDetailData(record);
      setDetailData(loadedDetail);
    } catch (detailLoadError) {
      setDetailError(detailLoadError.message || "Failed to load details.");
    } finally {
      setDetailLoading(false);
    }
  };

  return (
    <>
      <div className="master-card__header">
        <span className="responsive-data-view__title">{title}</span>
        <div className="master-card__actions master-card__actions--header">
          <div className="master-list-toolbar__search">
            <input
              type="search"
              placeholder="Search..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
          </div>

          <span className="hide-mobile">{sortedRecords.length} records</span>
          {headerExtras}
          {filterConfigs.length > 0 ? (
            <ActionIconDisplay
              icon="filter"
              label="Filters"
              active={isFiltersOpen}
              onClick={() => setIsFiltersOpen((current) => !current)}
              variant="toolbar"
            />
          ) : null}
          <ActionIconDisplay
            icon="excel"
            label="Excel"
            showLabel
            variant="toolbar"
            onClick={() =>
              downloadCsv({
                title,
                columns,
                records: sortedRecords
              })
            }
          />
          <ActionIconDisplay
            icon="pdf"
            label="PDF"
            showLabel
            variant="toolbar"
            onClick={() =>
              downloadPdf({
                title,
                columns,
                records: sortedRecords
              })
            }
          />
        </div>
      </div>

      {isFiltersOpen ? (
        <div className="data-toolbar">
          <div className="data-toolbar__filters">
            {filterConfigs.map((filter) => (
              <MultiSelectFilter
                key={filter.key}
                label={filter.label}
                options={filter.options}
                selectedValues={activeFilters[filter.key] || []}
                onChange={(values) =>
                  setActiveFilters((current) => ({
                    ...current,
                    [filter.key]: values
                  }))
                }
              />
            ))}
            {customFilterContent}
            {filterConfigs.length > 0 || customFilterContent ? (
              <div className="data-toolbar__clear">
                <button
                  type="button"
                  className="clear-filters-button"
                  onClick={() => {
                    setSearchTerm("");
                    setActiveFilters(Object.fromEntries(filterConfigs.map((filter) => [filter.key, []])));
                    onClearCustomFilters?.();
                  }}
                >
                  Clear Filters
                </button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {loading ? (
        <div className="table-state">
          <Spinner label={loadingMessage} />
        </div>
      ) : error ? (
        <p className="feedback feedback--error">{error}</p>
      ) : (
        <>
          <div className="table-wrap">
            <table className="master-table" ref={tableRef}>
              <colgroup>
                <col style={{ width: "72px", minWidth: "72px", maxWidth: "72px" }} />
                {columns.map((col) => (
                  <col key={col.key} style={getColumnWidthStyle(col)} />
                ))}
                {renderActions ? (
                  <col style={actionColumnStyle} />
                ) : null}
              </colgroup>
              <thead>
                <tr>
                  <th style={{ width: "72px", minWidth: "72px", maxWidth: "72px" }}>Sl.No.</th>
                  {columns.map((col) => (
                    <th
                      key={col.key}
                      onClick={() => handleSort(col.key)}
                      style={{ cursor: "pointer", ...getColumnWidthStyle(col) }}
                    >
                      {col.label}
                      {sortConfig?.key === col.key ? (
                        <span>{sortConfig.direction === "asc" ? " ^" : " v"}</span>
                      ) : null}
                    </th>
                  ))}
                  {renderActions ? (
                    <th style={actionColumnStyle}>Action</th>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {sortedRecords.length === 0 ? (
                  <tr>
                    <td colSpan={columns.length + (renderActions ? 2 : 1)} className="table-state">
                      {emptyMessage}
                    </td>
                  </tr>
                ) : (
                  paginatedRecords.map((record, index) => {
                    const group = groupBy ? groupBy(record) : null;
                    const previousGroup = groupBy && index > 0 ? groupBy(paginatedRecords[index - 1]) : null;
                    const startsGroup = group && (!previousGroup || previousGroup.key !== group.key);

                    return (
                    <Fragment key={record[rowKey] ?? index}>
                    {startsGroup ? (
                      <tr className="master-table__group-row">
                        <td colSpan={columns.length + (renderActions ? 2 : 1)}>
                          <span className="master-table__group-label">{group.label}</span>
                          <span className="master-table__group-count">
                            {groupCounts?.get(group.key) || 0}{" "}
                            {(groupCounts?.get(group.key) || 0) === 1 ? groupNoun.replace(/s$/, "") : groupNoun}
                          </span>
                        </td>
                      </tr>
                    ) : null}
                    <tr
                      className="master-table__row"
                      onDoubleClick={(event) => {
                        if (event.target.closest("input, select, textarea, button, a")) {
                          return;
                        }
                        handleRecordOpen(record);
                      }}
                    >
                      <td style={{ width: "72px", minWidth: "72px", maxWidth: "72px" }}>
                        {pageStart + index + 1}
                      </td>
                      {columns.map((col) => {
                        const isName =
                          col.key.toLowerCase().includes("name") ||
                          col.key.toLowerCase().includes("customer") ||
                          col.key.toLowerCase().includes("company") ||
                          col.key.toLowerCase().includes("agent");

                        return (
                          <td
                            key={col.key}
                            style={getColumnWidthStyle(col)}
                            className={[
                              col.highlight || isName ? "text-blue" : "",
                              col.className || ""
                            ]
                              .filter(Boolean)
                              .join(" ")}
                          >
                            {col.type === "document-links" ? (
                              <span className="document-links">
                                {String(getRecordValue(record, col.key) || "")
                                  .split("||")
                                  .map((value) => value.trim())
                                  .filter(Boolean)
                                  .map((link, linkIndex, links) => (
                                    <a
                                      key={link}
                                      href={/^https?:\/\//i.test(link) ? link : `${API_BASE}/${link.replace(/^\/+/, "")}`}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="text-blue"
                                      onClick={(event) => event.stopPropagation()}
                                    >
                                      {links.length === 1 ? "Link" : `Link ${linkIndex + 1}`}
                                    </a>
                                  ))}
                              </span>
                            ) : col.type === "document-link" && getRecordValue(record, col.key) ? (
                              <a
                                href={/^https?:\/\//i.test(String(getRecordValue(record, col.key)))
                                  ? String(getRecordValue(record, col.key))
                                  : `${API_BASE}/${String(getRecordValue(record, col.key)).replace(/^\/+/, "")}`}
                                target="_blank"
                                rel="noreferrer"
                                className="text-blue"
                                onClick={(event) => event.stopPropagation()}
                              >
                                Link
                              </a>
                            ) : col.type === "currency" ? (
                              formatCurrency(getRecordValue(record, col.key))
                            ) : renderCellText(getRecordValue(record, col.key))}
                          </td>
                        );
                      })}
                      {renderActions ? (
                        <td
                          className="master-table__actions-cell"
                          style={actionColumnStyle}
                          onClick={(event) => event.stopPropagation()}
                        >
                          <div className="table-actions">{renderActions(record)}</div>
                        </td>
                      ) : null}
                    </tr>
                    </Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          {sortedRecords.length > 0 ? (
            <TablePagination
              currentPage={currentPage}
              pageSize={pageSize}
              totalItems={sortedRecords.length}
              onPageChange={setCurrentPage}
              onPageSizeChange={setPageSize}
            />
          ) : null}
          <RecordDetailModal
            isOpen={Boolean(selectedRecord)}
            title={detailTitle || title}
            rows={detailRows}
            actions={selectedRecord && renderActions ? renderActions(selectedRecord) : null}
            onClose={() => {
              setSelectedRecord(null);
              setDetailData(null);
              setDetailError("");
              setDetailLoading(false);
            }}
          >
            {renderDetailExtra
              ? renderDetailExtra(selectedRecord, detailData, { loading: detailLoading, error: detailError })
              : null}
          </RecordDetailModal>
        </>
      )}
    </>
  );
}
