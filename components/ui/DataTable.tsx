import { Button } from "@/components/ui/button";
import { ChevronDownIcon, Delete, Plus } from "lucide-react";
import React, { useEffect, useMemo, useRef, useState } from "react";

export type ColumnConfig = {
    key: string;
    label: string;
    searchWithKey?: string | null;
    searchOutputKey?: string | null;
    filterWith?: string | null;
    type: "text" | "number" | "currency" | "date" | "search" | "button";
    data?: any[];
    required?: boolean;
    disabled?: boolean;
    width?: number | string;
};

export type RowData = Record<string, any> & {
    id?: string | number;
    checked?: boolean;
    CellProperty?: { column: string; disabled: boolean }[];
};

const genId = () => Math.random().toString(36).substring(2, 9);

function ButtonCell({
    ri,
    row,
    disabled,
    label,
    onClick
}: {
    ri: number;
    row: RowData;
    disabled?: boolean;
    label: string;
    onClick?: (e: { rowIndex: number; row: RowData }) => void;
}) {
    return (
        <div className="flex   items-center h-8 px-2">
            <Button
                type="button"
                disabled={disabled}
                onClick={() => {
                    if (onClick) {
                        onClick({ rowIndex: ri, row });
                    }
                }}
            >
                {label}
            </Button>
        </div>
    );
}

function makeEmptyRow(columns: ColumnConfig[]): RowData {
    const r: RowData = { id: genId(), checked: false, CellProperty: [] };
    columns.forEach((c) => {
        r[c.key] = c.type === "number" || c.type === "currency" ? 0 : "";
    });
    return r;
}

const formatCurrency = (value: number | string | undefined | null): string => {
    const num = Number(value);
    if (!Number.isFinite(num) || num === 0) return "";
    const formatted = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(num);
    return 'P' + formatted.replace(/[^0-9.,-]/g, '');
};

function SearchModal({
    anchorRect,
    items,
    onSelect,
    onClose,
    open,
}: {
    anchorRect: DOMRect | null;
    items: any[];
    onSelect: (item: any) => void;
    onClose: () => void;
    open: boolean;
}) {
    const ref = useRef<HTMLDivElement | null>(null);
    const inputRef = useRef<HTMLInputElement | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const getItemDisplay = (it: any) => {
        if (typeof it === "string") return it;
        return `${it.code ?? it.id ?? it.key} - ${it.name ?? it.description ?? it.desc ?? ""}`;
    };
    const filteredItems = useMemo(() => {
        if (!searchQuery) return items;
        const query = searchQuery.toLowerCase();
        return items.filter((item) =>
            getItemDisplay(item).toLowerCase().includes(query)
        );
    }, [items, searchQuery]);
    useEffect(() => {
        if (open) {
            setSearchQuery("");
            setTimeout(() => inputRef.current?.focus(), 0);
        }
    }, [open]);
    useEffect(() => {
        function onKey(e: KeyboardEvent) {
            if (e.key === "Escape") onClose();
            if (e.key === "Tab" && open && filteredItems.length > 0) {
                e.preventDefault();
                const selectedValue = filteredItems[0].code ?? filteredItems[0];
                onSelect(selectedValue);
                onClose();
            }
        }
        function handleClickOutside(e: MouseEvent) {
            if (open && ref.current && !ref.current.contains(e.target as Node)) {
                onClose();
            }
        }
        if (open) {
            document.addEventListener("keydown", onKey);
            document.addEventListener("mousedown", handleClickOutside);
        }
        return () => {
            document.removeEventListener("keydown", onKey);
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [open, onClose, filteredItems, onSelect]);

    if (!open || !anchorRect) return null;
    const style: React.CSSProperties = {
        position: "fixed",
        left: anchorRect.left,
        top: anchorRect.bottom + 5,
        zIndex: 9999,
        minWidth: 250,
        maxWidth: 400,
        maxHeight: 300,
        overflow: "visible",
        border: "1px solid var(--border)",
        borderRadius: 6,
        boxShadow: "var(--starbucks-card-shadow)",
        display: 'flex',
        flexDirection: 'column',
    };
    return (
        <div ref={ref} style={style} className="bg-card" role="dialog" aria-modal="true">
            <div style={{ padding: 8, borderBottom: '1px solid var(--border)' }}>
                <input
                    ref={inputRef}
                    type="text"
                    placeholder="Type to search..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full rounded border border-input bg-[#fffdfb] p-1 outline-none focus:border-ring focus:ring-2 focus:ring-ring/20 dark:bg-input/30"
                />
            </div>
            <div style={{ padding: 8, overflowY: "auto" }}>
                {filteredItems.length === 0 && <div className="text-muted-foreground" style={{ padding: 8 }}>No matching results</div>}
                {filteredItems.map((it, i) => (
                    <div
                        key={i}
                        style={{ padding: '6px 8px', cursor: "pointer", borderRadius: 4 }}
                        className="hover:bg-accent"
                        onMouseDown={(e) => {
                            e.preventDefault();
                            const selectedValue = it.code ?? it;
                            onSelect(selectedValue);
                        }}
                    >
                        {getItemDisplay(it)}
                    </div>
                ))}
            </div>
        </div>
    );
}

const getRequiredClass = (required?: boolean, value?: any) => {
    if (required && (value === "" || value === null || value === undefined)) {
        return "bg-red-50 dark:bg-red-900/20 ring-1 ring-inset ring-red-300 dark:ring-red-800 placeholder:text-red-300";
    }
    return "";
};

function TextCell({ value, onChange, disabled, onKeyDown, required }: { value: any; onChange: (v: any) => void; disabled?: boolean; onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void; required?: boolean }) {
    const displayValue = String(value ?? "");
    const size = Math.max(10, displayValue.length + 2);
    if (disabled) {
        return (
            <div className="flex h-8 items-center whitespace-nowrap border-none bg-secondary/70 px-2 text-sm outline-none">
                {displayValue}
            </div>
        );
    }
    return (
        <input
            required={required}
            className={`h-8 w-full border-none px-2 text-sm outline-none focus:bg-accent/25 ${getRequiredClass(required, value)} disabled:bg-muted-foreground/10 disabled:cursor-not-allowed`}
            disabled={disabled}
            value={value ?? ""}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={onKeyDown}
            onFocus={(e) => e.currentTarget.select()}
            size={size}
            placeholder={required ? "Required" : ""}
        />
    );
}

function NumberCell({ value, onChange, disabled, onKeyDown, required }: { value: any; onChange: (v: any) => void; disabled?: boolean; onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void; required?: boolean }) {
    const displayValue = String(value ?? "");
    const size = Math.max(8, displayValue.length + 2);
    return (
        <input
            required={required}
            inputMode="decimal"
            className={`h-8 w-full border-none px-2 text-right text-sm outline-none focus:bg-accent/25 ${getRequiredClass(required, value)} disabled:bg-muted-foreground/10 disabled:cursor-not-allowed`}
            disabled={disabled}
            value={value ?? ""}
            onChange={(e) => {
                const v = e.target.value;
                if (v === "" || /^-?\d*(\.\d*)?$/.test(v)) onChange(v === "" ? "" : Number(v));
            }}
            onKeyDown={onKeyDown}
            onFocus={(e) => e.currentTarget.select()}
            size={size}
        />
    );
}

function CurrencyCell({ value, onChange, disabled, onKeyDown, required }: { value: any; onChange: (v: any) => void; disabled?: boolean; onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void; required?: boolean }) {
    const [localValue, setLocalValue] = useState<string>(value === undefined || value === null ? "" : String(value));
    const [isFocused, setIsFocused] = useState(false);
    useEffect(() => {
        if (!isFocused) {
            setLocalValue(value === undefined || value === null ? "" : String(value));
        }
    }, [value, isFocused]);
    const displayValue = isFocused ? localValue : formatCurrency(localValue);
    const size = Math.max(12, displayValue.length + 2);
    const handleBlur = () => {
        setIsFocused(false);
        const v = localValue.trim();
        if (v === "") {
            onChange("");
            setLocalValue("");
            return;
        }
        const num = Number(v);
        if (Number.isFinite(num)) {
            onChange(num);
            setLocalValue(String(num));
        } else {
            const resetValue = Number.isFinite(value) ? value : 0;
            onChange(resetValue);
            setLocalValue(String(resetValue));
        }
    };
    return (
        <input
            required={required}
            inputMode="decimal"
            className={`h-8 w-full border-none px-2 text-right text-sm outline-none focus:bg-accent/25 ${getRequiredClass(required, value)} disabled:bg-muted-foreground/10 disabled:cursor-not-allowed`}
            disabled={disabled}
            value={displayValue}
            onFocus={(e) => {
                setIsFocused(true);
                setLocalValue(value === undefined || value === null ? "" : String(value));
                setTimeout(() => e.target.select(), 0);
            }}
            onBlur={handleBlur}
            onChange={(e) => {
                const v = e.target.value;
                if (v === "" || /^-?\d*(\.\d*)?$/.test(v)) setLocalValue(v);
            }}
            onKeyDown={onKeyDown}
            size={size}
        />
    );
}

function DateCell({ value, onChange, disabled, onKeyDown, required }: { value: any; onChange: (v: any) => void; disabled?: boolean; onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void; required?: boolean }) {
    return (
        <input
            required={required}
            type="date"
            className={`h-8 w-full border-none px-2 text-sm outline-none focus:bg-accent/25 ${getRequiredClass(required, value)} disabled:bg-muted-foreground/10 disabled:cursor-not-allowed`}
            disabled={disabled}
            value={value ?? ""}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={onKeyDown}
            size={12}
        />
    );
}

function SearchCell({
    value, ri, ci, col, disabled, setActive, onInputKeyDown, openSearchForCell, setCellValue, rowData, required
}: {
    value: any; ri: number; ci: number; col: ColumnConfig; disabled?: boolean; setActive: (v: { r: number, c: number }) => void; onInputKeyDown: (e: React.KeyboardEvent<HTMLInputElement>, r: number, c: number) => void; openSearchForCell: (r: number, c: number) => void; setCellValue: (r: number, k: string, v: any) => void; rowData: RowData; required?: boolean;
}) {
    const displayValue = (typeof value === "object" && value !== null) ? (value.code ?? value.id ?? String(value)) : String(value ?? "");
    const filterKey = col.filterWith;
    const isFilterMet = !filterKey || !!rowData[filterKey];
    const isInteractionDisabled = disabled || !isFilterMet;
    const size = Math.max(12, displayValue.length + 2);
    const requiredClass = getRequiredClass(required, value);
    return (
        <div style={{ display: "inline-flex", gap: 6, alignItems: "center" }} onClick={(e) => e.stopPropagation()} className={requiredClass ? `pr-1 ${requiredClass}` : ""}>
            <input
                required={required}
                value={displayValue}
                readOnly={isInteractionDisabled}
                className={`h-8 border-none px-2 text-sm outline-none focus:bg-accent/25 disabled:bg-muted-foreground/10 disabled:cursor-not-allowed`}
                onFocus={(e) => {
                    setActive({ r: ri, c: ci });
                    if (!isInteractionDisabled) e.currentTarget.select();
                }}
                onKeyDown={(e) => {
                    if (isInteractionDisabled && !['Tab', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Enter'].includes(e.key)) {
                        e.preventDefault();
                    }
                    onInputKeyDown(e, ri, ci);
                }}
                onDoubleClick={() => { if (!isInteractionDisabled) openSearchForCell(ri, ci); }}
                onChange={(e) => { if (!isInteractionDisabled) setCellValue(ri, col.key, e.target.value); }}
                size={size}
                placeholder={required ? "Select..." : ""}
            />
            <Button
                onMouseDown={(e) => { e.preventDefault(); if (!isInteractionDisabled) openSearchForCell(ri, ci); }}
                className={`mr-1 ${isInteractionDisabled ? "bg-muted hover:bg-muted" : ""}`}
                type="button"
                disabled={isInteractionDisabled}
                size="icon"
                variant="ghost"
            >
                <ChevronDownIcon className="h-4 w-4" />
            </Button>
        </div>
    );
}

export function DataTable({
    rows = [],
    columns = [] as ColumnConfig[],
    onChange,
    DisableAddLine = false,
    rowOnClick,
    widthFull = false
}: {
    rows?: RowData[];
    columns: ColumnConfig[];
    onChange?: (rows: RowData[]) => void;
    DisableAddLine?: boolean;
    rowOnClick?: (e: { rowIndex: number; row: RowData }) => void;
    widthFull?: boolean;
}) {
    const pendingTabRef = useRef<{ row: number; col: number } | null>(null);
    const [internalData, setInternalData] = useState<RowData[]>(() => {
        if (!rows || rows.length === 0) return [makeEmptyRow(columns)];
        return rows.map((r) => ({ ...r, id: r.id ?? undefined, checked: r.checked ?? false }));
    });
    const [active, setActive] = useState<{ r: number; c: number } | null>(null);
    const [searchOpen, setSearchOpen] = useState(false);
    const [searchAnchor, setSearchAnchor] = useState<DOMRect | null>(null);
    const [searchItems, setSearchItems] = useState<any[]>([]);
    const [searchMeta, setSearchMeta] = useState<{ row: number; col: number } | null>(null);
    const tableRef = useRef<HTMLTableElement | null>(null);

    useEffect(() => {
        const nextData = rows.length > 0 ? rows.map((r) => ({
            ...r,
            id: r.id ?? genId(),
            checked: r.checked ?? false
        })) : [makeEmptyRow(columns)];
        const currentIds = internalData.map(r => r.id).filter(Boolean).join(',');
        const nextIds = nextData.map(r => r.id).filter(Boolean).join(',');
        if (internalData.length !== nextData.length || currentIds !== nextIds || JSON.stringify(internalData) !== JSON.stringify(nextData)) {
            setInternalData(nextData);
        }
    }, [rows, columns]);

    const updateAndEmit = (newData: RowData[]) => {
        setInternalData(newData);
        if (onChange) {
            const cleanData = newData.map(({ checked, ...rest }) => rest);
            onChange(cleanData);
        }
    };

    const calculateRowTotals = (row: RowData) => {
        const qtyCol = columns.find((c) => c.key.toLowerCase().includes("qty") || c.key.toLowerCase().includes("quantity"));
        const priceCol = columns.find((c) => c.key.toLowerCase().includes("price"));
        const totalCol = columns.find((c) => c.key.toLowerCase().includes("total") || c.key.toLowerCase().includes("linetotal") || c.key.toLowerCase().includes("line_total"));
        if (qtyCol && priceCol && totalCol) {
            const q = Number(row[qtyCol.key] ?? 0);
            const p = Number(row[priceCol.key] ?? 0);
            const t = Number((q * p).toFixed(2));
            if (row[totalCol.key] !== t) return { ...row, [totalCol.key]: t };
        }
        return row;
    };

    function setCellValue(rowIndex: number, key: string, value: any) {
        const prev = [...internalData];
        let n = prev.map((r) => ({ ...r }));
        n[rowIndex] = { ...n[rowIndex], [key]: value };

        const sourceCol = columns.find((c) => c.key === key);

        if (sourceCol && sourceCol.type === "search" && sourceCol.data) {
            let selectedObject = null;
            if (value && typeof value === "object") {
                selectedObject = value;
            } else {
                selectedObject = sourceCol.data.find((it: any) => (it.code ?? it.key ?? it.id ?? String(it)) === String(value));
            }

            if (selectedObject) {
                columns.forEach((targetCol) => {
                    if (targetCol.searchWithKey === key) {
                        const outputKey = targetCol.searchOutputKey;
                        const fillValue = outputKey
                            ? selectedObject[outputKey]
                            : (selectedObject[targetCol.key] ?? selectedObject.name ?? selectedObject.description ?? selectedObject.desc ?? selectedObject.label);

                        if (fillValue !== undefined) {
                            n[rowIndex][targetCol.key] = fillValue;
                        }
                    }
                });
            }
        }

        columns.forEach((c) => {
            if (c.filterWith === key && n[rowIndex][key] !== prev[rowIndex][key]) {
                n[rowIndex][c.key] = c.type === "number" || c.type === "currency" ? 0 : "";
            }
        });

        n[rowIndex] = calculateRowTotals(n[rowIndex]);
        updateAndEmit(n);
    }

    const checkedRowsCount = useMemo(() => internalData.filter((r) => r.checked).length, [internalData]);

    function toggleRowChecked(rowIndex: number) {
        const newData = internalData.map((row, i) => (i === rowIndex ? { ...row, checked: !row.checked } : row));
        setInternalData(newData);
    }

    function addEmptyRow() {
        const newData = [...internalData, makeEmptyRow(columns)];
        updateAndEmit(newData);
        focusCell(internalData.length, 0);
    }

    function deleteSelectedRows() {
        const n = internalData.filter((r) => !r.checked);
        const newData = n.length === 0 ? [makeEmptyRow(columns)] : n;
        updateAndEmit(newData);
        setActive(null);
    }

    function openSearchForCell(rowIndex: number, colIndex: number) {
        const col = columns[colIndex];
        const rowData = internalData[rowIndex];
        const rowOverride = rowData.CellProperty?.find((cp) => cp.column === col.key);
        const isCellDisabled = rowOverride ? rowOverride.disabled : col.disabled;

        if (!col || col.type !== "search" || isCellDisabled) return;

        let itemsToSearch = col.data ?? [];
        if (col.filterWith) {
            const filterValue = internalData[rowIndex][col.filterWith];
            if (!filterValue) return;
            itemsToSearch = itemsToSearch.filter((item: any) => String(item[col.filterWith!] ?? item.group) === String(filterValue));
        }

        const table = tableRef.current;
        if (!table || itemsToSearch.length === 0) return;
        const cell = table.querySelectorAll("td")[rowIndex * (columns.length + 1) + colIndex + 1] as HTMLElement | undefined;
        setSearchAnchor(cell?.getBoundingClientRect() ?? null);
        setSearchItems(itemsToSearch);
        setSearchMeta({ row: rowIndex, col: colIndex });
        setSearchOpen(true);
    }

    function closeSearch() {
        setSearchOpen(false);
        setSearchMeta(null);
        setSearchAnchor(null);
        setSearchItems([]);
    }

    function handleSelectSearch(item: any) {
        if (!searchMeta) return;
        const { row, col } = searchMeta;
        const key = columns[col].key;
        const selectedValue = typeof item === "object" && item !== null ? item.code ?? item.id ?? item : item;
        setCellValue(row, key, selectedValue);
        pendingTabRef.current = { row, col };
        closeSearch();
        setTimeout(() => focusCell(row, col), 0);
    }

    function findNextEditableColumn(rowIdx: number, fromCol: number) {
        const rowData = internalData[rowIdx];
        for (let c = fromCol + 1; c < columns.length; c++) {
            const col = columns[c];
            const rowOverride = rowData.CellProperty?.find((cp) => cp.column === col.key);
            const isCellDisabled = rowOverride ? rowOverride.disabled : col.disabled;

            if (isCellDisabled) continue;
            if (col.type === "search" && col.filterWith && !rowData[col.filterWith]) continue;
            return c;
        }
        return null;
    }

    function focusCell(r: number, c: number) {
        const rr = Math.max(0, Math.min(r, internalData.length - 1));
        const cc = Math.max(0, Math.min(c, columns.length - 1));
        setActive({ r: rr, c: cc });
        setTimeout(() => {
            const idx = rr * (columns.length + 1) + cc + 1;
            const cell = tableRef.current?.querySelectorAll("td")[idx] as HTMLElement | undefined;
            const focusable = cell?.querySelector("input, button") as HTMLElement | undefined;
            focusable?.focus();
            if (focusable instanceof HTMLInputElement) focusable.select();
        }, 50);
    }

    function onCellKeyDown(e: React.KeyboardEvent, r: number, c: number) {
        const key = e.key;
        if (key === "Enter" || key === "ArrowDown") { e.preventDefault(); focusCell(r + 1, c); }
        else if (key === "ArrowUp") { e.preventDefault(); focusCell(r - 1, c); }
        else if (key === "ArrowLeft") focusCell(r, c - 1);
        else if (key === "ArrowRight") focusCell(r, c + 1);
    }

    function onInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>, r: number, c: number) {
        const col = columns[c];
        if (e.key === "Tab") {
            if (pendingTabRef.current?.row === r && pendingTabRef.current.col === c) {
                e.preventDefault();
                const nextCol = findNextEditableColumn(r, c);
                pendingTabRef.current = null;
                if (nextCol !== null) focusCell(r, nextCol);
                return;
            }
            if (col.type === "search") {
                if (col.filterWith && !internalData[r][col.filterWith]) { e.preventDefault(); return; }
                const value = internalData[r]?.[col.key];
                if (value === "" || value === null || value === undefined) { e.preventDefault(); openSearchForCell(r, c); }
            }
            return;
        }
        if (["Enter", "ArrowDown", "ArrowUp"].includes(e.key)) { e.preventDefault(); e.stopPropagation(); }
    }

    return (
        <div className="w-full">
            <div className="w-full overflow-auto">
                <table ref={tableRef} className={`border-collapse text-sm ${widthFull && "w-full "}`}   >
                    <thead  >
                        <tr  >
                            <th className="rounded-l-lg bg-secondary p-1 text-center" style={{ width: 40, minWidth: 40 }}>
                                <input type="checkbox" checked={internalData.length > 0 && checkedRowsCount === internalData.length} onChange={() => {
                                    const allChecked = internalData.length > 0 && checkedRowsCount === internalData.length;
                                    setInternalData((prev) => prev.map((r) => ({ ...r, checked: !allChecked })));
                                }} className="w-fit" />
                            </th>
                            {columns.map((col, i) => (
                                // <th key={col.key} className={`bg-muted   p-1  ${i === columns.length-1 ?"rounded-r-lg text-right":" text-left mr-2"}`} style={{ width: col.width ?? 'auto', whiteSpace: 'nowrap' }}>

                                <th key={col.key} className={`bg-secondary p-1 text-xs font-semibold uppercase text-foreground/70 ${i === columns.length - 1 ? "rounded-r-lg " : " text-left mr-2"}`} style={{ width: col.width ?? 'auto', whiteSpace: 'nowrap' }}>
                                    {col.label}
                                    {col.required && <span className="text-red-500 ml-1">*</span>}
                                </th>
                            ))}
                        </tr>
                    </thead>

                    <tbody>
                        <tr className="h-2">
                            <td colSpan={columns.length + 1}></td>
                        </tr>
                        {internalData.map((row, ri) => (
                            <tr key={ri + 'r'} className={row.checked ? "bg-[var(--starbucks-gold)]/25 text-foreground" : "hover:bg-accent/20"}>
                                <td className="p-0 border-t border-r text-center w-fit">
                                    <input type="checkbox" checked={!!row.checked} onChange={() => toggleRowChecked(ri)} className="w-fit" />
                                </td>
                                {columns.map((col, ci) => {
                                    const isActive = active?.r === ri && active?.c === ci;
                                    const cellClass = `p-0 border-t border-r ${isActive ? "bg-accent/45" : ""}`;
                                    const val = row[col.key];

                                    const rowOverride = row.CellProperty?.find((cp) => cp.column === col.key);
                                    const effectiveDisabled = rowOverride ? rowOverride.disabled : col.disabled;

                                    return (
                                        <td key={col.key} className={cellClass} onClick={() => focusCell(ri, ci)} onKeyDown={(e) => onCellKeyDown(e, ri, ci)} role="gridcell" aria-selected={isActive}>
                                            <div style={{ display: 'block', minWidth: col.type === 'date' ? '120px' : 'auto' }}>
                                                {col.type === "text" && <TextCell value={val} onChange={(v) => setCellValue(ri, col.key, v)} disabled={effectiveDisabled} onKeyDown={(e) => onInputKeyDown(e, ri, ci)} required={col.required} />}
                                                {col.type === "number" && <NumberCell value={val} onChange={(v) => setCellValue(ri, col.key, v)} disabled={effectiveDisabled} onKeyDown={(e) => onInputKeyDown(e, ri, ci)} required={col.required} />}
                                                {col.type === "currency" && <CurrencyCell value={val} onChange={(v) => setCellValue(ri, col.key, v)} disabled={effectiveDisabled} onKeyDown={(e) => onInputKeyDown(e, ri, ci)} required={col.required} />}
                                                {col.type === "date" && <DateCell value={val} onChange={(v) => setCellValue(ri, col.key, v)} disabled={effectiveDisabled} onKeyDown={(e) => onInputKeyDown(e, ri, ci)} required={col.required} />}
                                                {col.type === "button" && row.type !== "sub" && <ButtonCell ri={ri} row={row} disabled={effectiveDisabled} label={col.label} onClick={rowOnClick} />}
                                                {col.type === "search" && <SearchCell value={val} ri={ri} ci={ci} col={col} disabled={effectiveDisabled} setActive={setActive} onInputKeyDown={onInputKeyDown} openSearchForCell={openSearchForCell} setCellValue={setCellValue} rowData={row} required={col.required} />}
                                            </div>
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
                <SearchModal anchorRect={searchAnchor} items={searchItems} onSelect={handleSelectSearch} onClose={closeSearch} open={searchOpen} />
            </div>
            {!DisableAddLine && (
                <div className="flex gap-2 items-center mx-2 mt-2">
                    <Button type="button" onClick={addEmptyRow} className="mr-2"><Plus className="h-4 w-4 mr-2" /> Add Row</Button>
                    {checkedRowsCount > 0 && <Button type="button" variant="destructive" onClick={deleteSelectedRows}><Delete className="h-4 w-4 mr-2" /> Delete Selected ({checkedRowsCount})</Button>}
                </div>
            )}
        </div>
    );
}
