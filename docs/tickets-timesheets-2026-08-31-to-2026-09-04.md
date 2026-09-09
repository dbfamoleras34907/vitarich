# Tickets and timesheets: August 31 to September 4, 2026

Prepared from this repository's non-merge commits by `dbfamoleras34907`, using the inclusive Asia/Manila date range. Ticket numbers below are review references, not database IDs. Database insertion has not been performed in this review.

The existing SQL draft uses Workspace owner 1 (Deanmark Batucan Famoleras), project 4 (Broiler), activity type 1, and task type 1. These settings came from the earlier draft and have not been verified against the current database. Timesheets are Draft; new tickets use the first active workflow status.

Hours are estimated allocations using the previously requested 9-hour schedule, not time measured by commits. August 31 and September 2 have no matching commits; work is distributed from the following committed changes. Commit evidence establishes checked-in implementation, not deployment or successful runtime testing.

## Ticket entries

| Ref | Subject | Description | Commit evidence | Hours |
| --- | --- | --- | --- | ---: |
| T1 | Goods Receipt Excel import and export | Add Stock In spreadsheet templates, dropdown validation, row parsing, expiry-date handling, and validated item-line import. | `604c1df`, September 1; refinements in `2dfc88c` | 8 |
| T2 | Excel-style table editing and navigation | Add the reusable compact Excel grid with inline editing, selection, keyboard navigation, copy/paste, resizing, and scrolling. | `12ba49f`, September 1; refinements in `2dfc88c`, `0c14efd` | 5 |
| T3 | Five-level Item Group hierarchy | Add optional subgroup hierarchy maintenance, leaf selection, validation, dependency-safe voiding, and Item Master subgroup persistence. | `2dfc88c`, September 1; `0c14efd`, September 3 | 9 |
| T4 | Atomic Item Master spreadsheet import | Add transactional import, row validation, duplicate skipping, code allocation, advisory locking, subgroup persistence, and rollback on error. | `2dfc88c` import groundwork; `0c14efd` transactional import, September 3 | 9 |
| T5 | Compact Item Master grid and Stock In integration | Refine compact grid layout, subgroup cascade, import template, shared repositories, and Stock In group display. | `0c14efd`, September 3 | 5 |
| T6 | Vaccination and Meds inventory module | Add VNM forms and schema, farm/warehouse selection, FIFO allocation, posting and void reversal, settings, navigation, permissions, and notification registration. | `f1c5a3d`, September 4 | 9 |
| | **Total** | | | **45** |

## Daily timesheet entries

| Date | Time | Ticket | Work description | Hours |
| --- | --- | --- | --- | ---: |
| August 31 | 08:00-12:00 | T1 | Build Stock In Excel template, dropdown validations, import parser, and expiry-date handling. | 4 |
| August 31 | 13:00-18:00 | T2 | Develop compact Excel grid editing, selection, keyboard navigation, copy/paste, resizing, and scrolling. | 5 |
| September 1 | 08:00-12:00 | T1 | Integrate and refine validated Excel import/export for Goods Receipt item lines. | 4 |
| September 1 | 13:00-18:00 | T3 | Add five-level subgroup selection, hierarchy maintenance, leaf rules, and Item Master persistence. | 5 |
| September 2 | 08:00-12:00 | T3 | Refine hierarchy validation, full-path selectors, authorized mutations, and dependency-safe voiding. | 4 |
| September 2 | 13:00-18:00 | T4 | Develop transactional import, row validation, duplicate skipping, locking, and rollback safeguards. | 5 |
| September 3 | 08:00-12:00 | T4 | Complete import RPC, authorized API, code allocation, subgroup persistence, and error reporting. | 4 |
| September 3 | 13:00-18:00 | T5 | Refine Item Master grid, import workbook, subgroup cascade, repositories, and Stock In display. | 5 |
| September 4 | 08:00-12:00 | T6 | Implement VNM schema, repositories, farm/warehouse rules, FIFO allocation, posting, and void reversal. | 4 |
| September 4 | 13:00-18:00 | T6 | Build VNM list/create/edit/view/settings, navigation, permissions, and notification registration. | 5 |

Each day totals 9 hours, excluding lunch from 12:00 to 13:00.

## SQL artifact and review findings

Use [the existing transactional SQL script](../app/wks/task_timeline_2026-08-31_to_2026-09-04.sql). It contains six task seeds, five daily headers, and ten time allocations. It validates configured foreign IDs, creates/reactivates a default task status if none is active, reuses matching tasks and daily headers, and skips matching active time entries.

The **Timeline SQL** modal in `/wks/timelines` provides this exact fixed-period script after signed-in user and server-side password validation. It supports preview, copy, and download; it does not execute SQL. Timesheet remark prefixes have been removed. Summary queries identify seed entries by date, project, task, time, and hours instead of the removed prefix. Existing persisted remarks are not updated by this insert-only script.

Before execution, check existing records for the owner and dates: the script appends to existing headers, so unrelated existing entries can increase daily totals beyond 9 hours. Matching tasks are reused by project and subject. Current database state and successful execution remain unverified.

Removed the earlier timesheet claim that commit `057f4ea` corrected BR Clean Up posting SQL: inspection shows that commit only removed a comment marker from a blank line. It does not support a functional repair entry. Merge commits and commits by other authors are not counted as separate work allocations.
