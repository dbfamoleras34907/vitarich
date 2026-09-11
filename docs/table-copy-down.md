# Table copy down

Right-click an editable cell and select **Copy down** in the shadcn context menu
to repeat its value in all editable cells below it in the same column.
The shared confirmation asks **Are you sure you want to copy down?**
Choose **Copy down** to apply the values, or **Cancel** to leave them unchanged.
`DynamicTable` with `ExcelTable={true}` also supports dragging the selected cell's
bottom-right square to choose a shorter range. Escape cancels an active drag.

The source value is repeated in the same column. Read-only target cells are
skipped. Existing `editable` and `parseValue` column settings still apply. The
changes go through the existing `onCellsChange` / `onDataChange` flow in one batch;
the module's existing save behavior determines persistence. Hidden rows and
other pages are not included. If rows or columns change during the drag or
confirmation, the pending copy is discarded.

For another editable HTML table, reuse `useTableCopyDown` from
`hooks/useTableCopyDown.ts` under the application's `ConfirmProvider`:

- Pass the visible `rows`, `columns`, loading/read-only `disabled` state,
  `isEditable`, `getValue`, and an `onCopy` callback using the table's existing
  edit/validation flow. Keep row and column array references stable between
  unrelated renders.
- Render editable cells with `TableCopyDownCell` from
  `components/ui/TableCopyDownCell.tsx`. Set `canCopyDown` according to the cell's
  edit permissions and whether rows exist below it. Set `onCopyDown` to call
  `copyToBottom(rowIndex, columnIndex)`.
- For optional drag support, set `data-copy-down-row` to each cell's zero-based
  visible row index. Spread `getHandleProps(rowIndex, columnIndex)` onto a button inside
  the source cell. Give it `touch-none` and an accessible label.
- Use `isCopyTarget(rowIndex, columnIndex)` to highlight editable destinations.

Custom tables must be connected explicitly so their validation and edit
permissions are preserved.

## Harvest & Delivery

The New Harvest & Delivery Issue Lines table uses the right-click menu. It is
enabled only for editable Broiler delivery drafts when saving is allowed.
Each visible row is an allocation group; the existing delivery spreadsheet
preparation validates the whole copied range before applying it. Building, item,
batch, UOM, quantity, date, and transport values follow that same bulk-edit path.
Calculated columns remain read-only. No Post/Edit/Void persistence path is changed
by copying cells in the unsaved form.
