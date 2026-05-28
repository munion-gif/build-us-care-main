param(
  [string]$SourceDir = "C:\Users\user\Desktop\build_us_care"
)

Add-Type -AssemblyName System.IO.Compression.FileSystem

function Get-CellColumnIndex([string]$Reference) {
  $letters = ([regex]::Match($Reference, "^[A-Z]+")).Value
  $index = 0
  foreach ($char in $letters.ToCharArray()) {
    $index = ($index * 26) + ([int][char]$char - [int][char]'A' + 1)
  }
  return $index - 1
}

function Get-SharedStrings($zip) {
  $entry = $zip.GetEntry("xl/sharedStrings.xml")
  if (-not $entry) { return @() }
  $stream = $entry.Open()
  try {
    $reader = New-Object System.IO.StreamReader($stream)
    [xml]$xml = $reader.ReadToEnd()
  } finally {
    if ($reader) { $reader.Dispose() }
    $stream.Dispose()
  }
  $strings = New-Object System.Collections.Generic.List[string]
  foreach ($item in $xml.sst.si) {
    if ($item.t) {
      $strings.Add([string]$item.t)
    } elseif ($item.r) {
      $parts = @()
      foreach ($run in $item.r) {
        if ($run.t) { $parts += [string]$run.t }
      }
      $strings.Add(($parts -join ""))
    } else {
      $strings.Add("")
    }
  }
  return $strings.ToArray()
}

function Get-CellValue($cell, $sharedStrings) {
  $type = [string]$cell.t
  if ($type -eq "s") {
    $idx = [int]$cell.v
    if ($idx -ge 0 -and $idx -lt $sharedStrings.Count) { return $sharedStrings[$idx] }
    return ""
  }
  if ($type -eq "inlineStr") {
    if ($cell.is.t) { return [string]$cell.is.t }
    return ""
  }
  if ($cell.v) { return [string]$cell.v }
  return ""
}

function Read-XlsxRows([string]$Path) {
  $zip = [System.IO.Compression.ZipFile]::OpenRead($Path)
  try {
    $shared = Get-SharedStrings $zip
    $workbookEntry = $zip.GetEntry("xl/workbook.xml")
    $relsEntry = $zip.GetEntry("xl/_rels/workbook.xml.rels")
    $workbookReader = New-Object System.IO.StreamReader($workbookEntry.Open())
    $relsReader = New-Object System.IO.StreamReader($relsEntry.Open())
    try {
      [xml]$workbook = $workbookReader.ReadToEnd()
      [xml]$rels = $relsReader.ReadToEnd()
    } finally {
      $workbookReader.Dispose()
      $relsReader.Dispose()
    }

    $relMap = @{}
    foreach ($rel in $rels.Relationships.Relationship) {
      $relMap[[string]$rel.Id] = [string]$rel.Target
    }

    $result = @()
    foreach ($sheet in $workbook.workbook.sheets.sheet) {
      $rid = $sheet.GetAttribute("id", "http://schemas.openxmlformats.org/officeDocument/2006/relationships")
      $target = $relMap[$rid]
      if (-not $target) { continue }
      $sheetPath = if ($target.StartsWith("/")) { $target.TrimStart("/") } else { "xl/$target" }
      $entry = $zip.GetEntry($sheetPath)
      if (-not $entry) { continue }
      $sheetReader = New-Object System.IO.StreamReader($entry.Open())
      try {
        [xml]$sheetXml = $sheetReader.ReadToEnd()
      } finally {
        $sheetReader.Dispose()
      }
      $rows = @()
      foreach ($row in $sheetXml.worksheet.sheetData.row) {
        $values = @{}
        foreach ($cell in $row.c) {
          $values[(Get-CellColumnIndex ([string]$cell.r))] = Get-CellValue $cell $shared
        }
        if ($values.Count -eq 0) { continue }
        $max = ($values.Keys | Measure-Object -Maximum).Maximum
        $rowValues = for ($i = 0; $i -le $max; $i++) {
          if ($values.ContainsKey($i)) { $values[$i] } else { "" }
        }
        $rows += ,$rowValues
      }
      $result += [pscustomobject]@{
        Sheet = [string]$sheet.name
        Rows = $rows
      }
    }
    return $result
  } finally {
    $zip.Dispose()
  }
}

Get-ChildItem -LiteralPath $SourceDir -Recurse -Filter *.xlsx | Sort-Object FullName | ForEach-Object {
  $workbook = Read-XlsxRows $_.FullName
  foreach ($sheet in $workbook) {
    $nonEmpty = @($sheet.Rows | Where-Object { (@($_ | Where-Object { $_ -ne "" }).Count) -gt 0 })
    $sampleRows = @($nonEmpty | Select-Object -First 6)
    [pscustomobject]@{
      Workbook = $_.FullName.Replace($SourceDir, "").TrimStart("\")
      Sheet = $sheet.Sheet
      RowCount = $nonEmpty.Count
      Sample = ($sampleRows | ForEach-Object { ($_ -join " | ") }) -join "`n"
    }
  }
} | ConvertTo-Json -Depth 5
