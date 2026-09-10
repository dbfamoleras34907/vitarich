$ErrorActionPreference = 'Stop'
$excelCheck = $null
$workbookCheck = $null
try {
  $excelCheck = New-Object -ComObject Excel.Application
  $excelCheck.Visible = $false
  $excelCheck.DisplayAlerts = $false
  $excelCheck.AutomationSecurity = 3
  $templatePath = (Resolve-Path (Join-Path $PSScriptRoot '../../public/templates/item-master-addition.xlsx')).Path
  $workbookCheck = $excelCheck.Workbooks.Open($templatePath, 0, $true)
  $sheetCheck = $workbookCheck.Worksheets.Item('Item Master Addition')
  $workbookCheck.Activate()
  $sheetCheck.Activate()
  $sheetCheck.Range('B7').Value2 = 'FEED - FGFEEDS'
  $excelCheck.CalculateFull()
  $formulaCheck = $sheetCheck.Range('B8').Validation.Formula1
  # Worksheet formulas exercise the real calculation engine; COM Evaluate
  # does not consistently return INDIRECT reference results as Range objects.
  $sheetCheck.Range('E1').Formula = '=COUNTA(' + $formulaCheck.TrimStart('=') + ')'
  $sheetCheck.Range('E2').Formula = '=INDEX(' + $formulaCheck.TrimStart('=') + ',1)'
  $excelCheck.CalculateFull()
  if ($sheetCheck.Range('E1').Value2 -ne 16) { throw 'FEED Level 1 did not resolve to 16 choices in Excel.' }
  $firstChoice = $sheetCheck.Range('E2').Value2
  if ($firstChoice -ne '1 - FG-COMM-ANML-BRLR-CRUM') { throw 'Unexpected first FEED subgroup.' }
  $sheetCheck.Range('B8').Value2 = $firstChoice
  if (-not $sheetCheck.Range('B8').Validation.Value) { throw 'Excel rejected a valid FEED subgroup.' }
  $sheetCheck.Range('E3').Formula = '=COUNTA(' + $sheetCheck.Range('B9').Validation.Formula1.TrimStart('=') + ')'
  $excelCheck.CalculateFull()
  if ($sheetCheck.Range('E3').Value2 -ne 16) { throw 'FEED Level 2 did not resolve to 16 choices.' }
  $sheetCheck.Range('B8').Value2 = 'INVALID SUBGROUP'
  if ($sheetCheck.Range('B8').Validation.Value) { throw 'Excel accepted an invalid subgroup.' }
  $sheetCheck.Range('B7').ClearContents()
  $excelCheck.CalculateFull()
  if ($sheetCheck.Range('E1').Value2 -ne 0) { throw 'Blank Item Group should have no subgroup values.' }
  Write-Output 'PASS in Microsoft Excel: FEED Level 1 and Level 2 each resolve to 16 choices; valid selection accepted; invalid selection rejected; blank Item Group has no choices.'
} finally {
  # Always close without saving, leaving the downloadable form blank.
  if ($null -ne $workbookCheck) { $workbookCheck.Close($false) }
  if ($null -ne $excelCheck) {
    $excelCheck.Quit()
    [void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($excelCheck)
  }
}
