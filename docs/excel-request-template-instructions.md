# Excel Request Template Instructions

Use this guide whenever adding or updating an Excel request template in Vitarich. It records the agreed requirements for the **Others > Excel Request Files** module and the first **Farm Master Addition** template. Read the repository's `AGENTS.md` alongside this guide.

## Agreed requirements for every template

1. Keep the **Others** sidebar group immediately after **Settings**.
2. Place request templates inside **Excel Request Files** at `/others/excel-request-files`. Add future templates to this page.
3. Provide a ready-to-download `.xlsx` file for each request type, with a clear title and brief description.
4. Include the fields from the corresponding application form or stage specified by the user, plus any explicitly requested extra fields. Preserve the application's labels and order.
5. **If a field is a dropdown in the application, it must also be a working dropdown in Excel.** Match the available choices and their order. A list of choices on a reference sheet alone does not satisfy this requirement.
6. Provide **Download Excel Template** and **Copy Link** actions for each template.
7. Copy Link must copy an absolute URL to the Excel file. The user can paste and send that URL to another person.
8. A recipient must be able to download the template through that link **without an account or signing in**.

## Workbook conventions

- Use a blank, clearly labeled request form with readable instructions and enough space for entries.
- Keep the template title and field labels visible. Distinguish editable cells from system-assigned fields.
- Preserve text identifiers and leading zeroes, including TIN and contact numbers.
- Match required and optional fields to the source form. Explain system-generated values rather than asking the requester to invent them.
- Implement dropdowns with Excel list validation in the actual input cells. Keep the dropdown arrow available and provide a clear invalid-selection message.
- Reuse shared application option constants when available. Verify any locally defined choices against the source form before generating the workbook.
- Use worksheet-backed lists for long option sets. The Farm Master Addition template uses a `Choices` sheet and `INDIRECT` references, including the complete Region list.
- Rebuild the downloadable workbook when its fields or choices change. Updating only the generator does not update the file users download.

## Farm Master Addition baseline

The requested content is **all farm information from the first stage of Farm Addition / Farm Setup, plus Number of Buildings**. Use one template per farm.

| Order | Field | Excel input / instruction |
| --- | --- | --- |
| 1 | Farm Code | Leave blank; assigned automatically during farm setup |
| 2 | Farm Name | Required text |
| 3 | Farm Type | Required dropdown: Breeder Farm, Hatcher, Broiler |
| 4 | Production Model | Optional dropdown: Internal, Contract Grower |
| 5 | Island Group | Optional dropdown: Luzon, Visayas, Mindanao |
| 6 | Region | Optional dropdown using all values from `PHILIPPINE_REGIONS` |
| 7 | TIN No. | Required text; preserve leading zeroes |
| 8 | Contact Person | Required text |
| 9 | Contact Number | Required text; preserve leading zeroes |
| 10 | Telephone No. | Required text; preserve leading zeroes |
| 11 | Address | Required text |
| 12 | Barangay | Required text |
| 13 | City / Municipality | Required text |
| 14 | Province | Required text |
| 15 | Number of Buildings | Required whole-number entry; current template instructions specify 0 or more |

Source form: [`app/a_dean/farm/setup/Layout.tsx`](../app/a_dean/farm/setup/Layout.tsx). Shared profile choices: [`lib/farmProfileOptions.ts`](../lib/farmProfileOptions.ts). Recheck these sources when updating the template.

The four current dropdown inputs are `B6` (Farm Type), `B7` (Production Model), `B8` (Island Group), and `B9` (Region) on the `Farm Master Addition` worksheet. Recalculate these targets if the workbook layout changes.

## Download and sharing implementation

### Item Master Addition

Use the visible fields from `app/a_dean/items/new/Layout.tsx`: Item Code, Item Name, Barcode, Item Group, Sub Group Levels 1-3, FMS Group, UoM Group, Description, Inventory, Sales, Purchase, Delivery, Manage by Batch, Min On Hand, Max On Hand, and Default Expiration in Months.

- Item Code is assigned during creation. Preserve Barcode as text.
- Item Group and UoM Group require the current catalog choices, using their visible `Code - Name` labels and source order.
- Sub Group choices match the selected root Item Group and the subgroup level, as in `SubItemGroupCascade.tsx`. Complete levels in order; clear lower selections after changing an earlier selection.
- Use named ranges for subgroup lists and the `Group Lookup` sheet to map each visible Item Group label to its level-specific range. Keep `INDIRECT` outside the conditional lookup so the validation source returns a range. Replace the writer's empty `definedNames` element rather than inserting a duplicate.
- Verify subgroup behavior in Excel when available with `scripts/tests/item-request-template-excel.ps1`. It opens the file read-only, tests FEED choices and validation, then closes without saving. XML presence alone does not establish that Excel can use a dependent dropdown.
- FMS Group order is Breeder, Hatchery, Broiler. Represent the five usage/batch switches with Yes/No dropdowns.
- Use non-negative quantity validation and whole-number expiration months. Max On Hand must be at least Min On Hand when entered.
- The generator is `scripts/generate-item-request-template.mjs`. `--verify-fixture` checks synthetic data in a temporary workbook and never creates the public download.
- The generator reuses existing catalog read functions. If normal RLS access cannot read the lists, obtain explicit approval before using `--catalog-admin` to read with the server credential and publish catalog labels in a public workbook. Never embed credentials, business records, or private profile data.
- Generate the real workbook and verify it before enabling its page actions. The intended file is `public/templates/item-master-addition.xlsx`.

### Shared download behavior

- Store public blank templates under `public/templates/` with stable, descriptive `.xlsx` filenames.
- Use the same file path for Download Excel Template and Copy Link.
- Build the copied URL from the current site's origin and the template path. Share a deployed, reachable site URL with external recipients.
- Show a success toast after copying. If automatic clipboard access fails, show a selectable URL and an actionable error message.
- Allow anonymous access to each intended template file in `proxy.ts` before the session check. Use an exact file path, following the existing Farm Master Addition exception.
- Configure `Content-Disposition: attachment` and a readable filename in `next.config.ts` so opening the shared URL downloads the file.
- Keep the Excel Request Files page under its existing View permission. Anonymous access is for the blank template files; it does not grant access to application pages or business data.
- Copy Link lets the user choose where and to whom to send the URL. The current feature does not select recipients or send messages automatically.
- Deploy the workbook together with any proxy and download-header changes before reporting that a new public URL is live.

## Current implementation references

| Purpose | File |
| --- | --- |
| Sidebar group and module registration | [`lib/Defaults/DefaultValues.ts`](../lib/Defaults/DefaultValues.ts) |
| Template page and actions | [`app/others/excel-request-files/page.tsx`](../app/others/excel-request-files/page.tsx) |
| Farm template generator | [`scripts/generate-farm-request-template.mjs`](../scripts/generate-farm-request-template.mjs) |
| Downloadable farm workbook | [`public/templates/farm-master-addition.xlsx`](../public/templates/farm-master-addition.xlsx) |
| Anonymous template access | [`proxy.ts`](../proxy.ts) |
| Attachment response headers | [`next.config.ts`](../next.config.ts) |

The current generator uses the repository's existing `write-excel-file` library and reads back the workbook with `read-excel-file`. Regenerate it from the repository root with:

```powershell
node scripts/generate-farm-request-template.mjs
```

## Completion checklist for future additions

- Confirm the requested source form or stage and extra fields; inspect the actual form before building.
- Verify the workbook contains every requested field in the correct order and starts with blank request inputs.
- Verify every application dropdown has an Excel validation rule on the correct input cell and references the complete matching option set.
- Read back the exported workbook and inspect its validation definitions; a successful export alone does not prove the dropdowns exist.
- Confirm both page actions target the delivered file and Copy Link produces an absolute URL.
- Verify the exact template URL bypasses authentication while protected pages and unrelated files retain their access behavior.
- Verify the attachment header and filename for direct-link downloads.
- Run relevant lint and static checks for changed code, plus `git diff --check`. Report source/static verification separately from live deployment or Excel UI testing.
- Follow the repository browser rule: do not attempt browser checks unless the user explicitly requests them.

These templates collect information for a request. Downloading or copying a link does not create, edit, post, or void a business document. If a future request adds submission or persistence, apply the repository's data-access and notification requirements to those operations.
