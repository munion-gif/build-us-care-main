param(
  [string]$SourceDir = "C:\Users\user\Desktop\build_us_care",
  [string]$ProjectRoot = (Resolve-Path ".").Path
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

$publicProductsDir = Join-Path $ProjectRoot "public\products"
$toiletJsonPath = Join-Path $ProjectRoot "lib\toilet-products.generated.json"
$replacementJsonPath = Join-Path $ProjectRoot "lib\replacement-products.generated.json"

function Get-NodeText($node) {
  if ($null -eq $node) { return "" }
  $text = [string]$node
  if ($text -eq "System.Xml.XmlElement") { $text = [string]$node.InnerText }
  return $text.Trim()
}

function Normalize-Text([string]$value) {
  if ([string]::IsNullOrWhiteSpace($value)) { return "" }
  $text = $value -replace "`r`n?", "`n"
  $lines = $text -split "`n" | ForEach-Object { ($_ -replace "\s+", " ").Trim() } | Where-Object { $_ }
  return ($lines -join " ").Trim()
}

function Normalize-MultilineText([string]$value) {
  if ([string]::IsNullOrWhiteSpace($value)) { return "" }
  $text = $value -replace "`r`n?", "`n"
  $lines = $text -split "`n" | ForEach-Object { ($_ -replace "[\t ]+", " ").Trim() } | Where-Object { $_ }
  return ($lines -join "`n").Trim()
}

function Normalize-Brand([string]$value) {
  $brand = Normalize-Text $value
  if ($brand -replace "\s+", "" -eq "아메리칸스탠다드") { return "아메리칸스탠다드" }
  return $brand
}

function Normalize-Key([string]$value) {
  if ([string]::IsNullOrWhiteSpace($value)) { return "" }
  return (($value.ToUpperInvariant()) -replace "[^A-Z0-9가-힣]", "")
}

function Open-ZipReadShared([string]$Path) {
  $stream = [System.IO.File]::Open($Path, [System.IO.FileMode]::Open, [System.IO.FileAccess]::Read, [System.IO.FileShare]::ReadWrite)
  $zip = New-Object System.IO.Compression.ZipArchive($stream, [System.IO.Compression.ZipArchiveMode]::Read, $false)
  return [pscustomobject]@{ Zip = $zip; Stream = $stream }
}

function Resolve-ZipTarget([string]$BaseDir, [string]$Target) {
  if ([string]::IsNullOrWhiteSpace($Target)) { return "" }
  if ($Target.StartsWith("/")) { return $Target.TrimStart("/") }
  $parts = New-Object System.Collections.Generic.List[string]
  foreach ($part in (($BaseDir -split "/") + ($Target -split "/"))) {
    if (-not $part -or $part -eq ".") { continue }
    if ($part -eq "..") {
      if ($parts.Count -gt 0) { $parts.RemoveAt($parts.Count - 1) }
      continue
    }
    $parts.Add($part)
  }
  return ($parts.ToArray() -join "/")
}

function Normalize-ImageModelKey([string]$value) {
  $key = Normalize-Key $value
  if (-not $key) { return "" }
  return (($key -replace "핸들", "") -replace "손잡이", "") -replace "(대|중|소|그립)$", ""
}

function Get-ImageAliasKeys([string]$model, [string]$sku) {
  $text = Normalize-Key "$model $sku"
  $aliases = New-Object System.Collections.Generic.List[string]
  $bidetAliases = @{
    "DST1100" = "SMARTLET1100"
    "DST1300" = "SMARTLET1300"
    "DST1300R" = "SMARTLET1300R"
    "DST2200" = "SMARTLET2200"
  }
  foreach ($key in $bidetAliases.Keys) {
    if ($text.Contains($key) -and -not $aliases.Contains($bidetAliases[$key])) {
      $aliases.Add($bidetAliases[$key])
    }
  }
  return $aliases.ToArray()
}

function Add-UniqueSearchKey($list, [string]$key) {
  $normalized = Normalize-Key $key
  $validLength = $normalized.Length -ge 3 -or $normalized -match "^[가-힣]{2,}[A-Z]?$"
  if ($validLength -and -not $list.Contains($normalized)) {
    $list.Add($normalized)
  }
}

function Get-ImageSearchKeys([string]$model, [string[]]$skuCodes) {
  $keys = New-Object System.Collections.Generic.List[string]
  $genericTokens = @(
    "수전", "세면", "세면수전", "샤워", "샤워수전", "욕조", "샤워욕조수전", "레인샤워", "주방", "주방수전",
    "탑볼", "원홀", "벽붙이", "선반형", "양변기", "세면기", "비데", "환풍기", "욕실", "액세서리", "악세서리",
    "핸들", "손잡이", "교체", "설치", "메인", "THUM", "IMG", "IMAGE", "MAIN", "ONE", "TWO", "WAY"
  )

  foreach ($code in $skuCodes) {
    Add-UniqueSearchKey $keys $code
    $codeRoot = ([regex]::Match($code.ToUpperInvariant(), "^[A-Z]+[0-9]+")).Value
    if ($codeRoot) { Add-UniqueSearchKey $keys $codeRoot }
  }

  $englishTokens = New-Object System.Collections.Generic.List[string]
  foreach ($match in [regex]::Matches($model.ToUpperInvariant(), "[A-Z][A-Z0-9]{2,}")) {
    $token = Normalize-Key ([string]$match.Value)
    if ($token -and $token -notmatch "^[0-9]+$" -and -not $genericTokens.Contains($token)) {
      Add-UniqueSearchKey $keys $token
      $englishTokens.Add($token)
    }
  }
  foreach ($match in [regex]::Matches((Normalize-Key $model), "[A-Z]{1,3}[0-9]{2,}")) {
    Add-UniqueSearchKey $keys ([string]$match.Value)
  }
  if ($englishTokens.Count -ge 2) {
    Add-UniqueSearchKey $keys ($englishTokens[0] + $englishTokens[1])
  }

  foreach ($match in [regex]::Matches($model, "[가-힣]{2,}")) {
    $token = Normalize-Key ([string]$match.Value)
    if ($token -and -not $genericTokens.Contains($token)) {
      Add-UniqueSearchKey $keys $token
    }
  }

  $modelKey = Normalize-Key $model
  foreach ($match in [regex]::Matches($modelKey, "[가-힣]{2,}[A-Z]")) {
    Add-UniqueSearchKey $keys ([string]$match.Value)
  }

  if ($modelKey.Contains("LAKEROUND")) {
    Add-UniqueSearchKey $keys "LAKER"
    Add-UniqueSearchKey $keys "레이크R"
  }
  if ($modelKey.Contains("LAKESQUARE")) {
    Add-UniqueSearchKey $keys "LAKES"
    Add-UniqueSearchKey $keys "레이크S"
  }
  if ($modelKey.Contains("PLATROUND")) {
    Add-UniqueSearchKey $keys "PLATROUND"
    Add-UniqueSearchKey $keys "플랫라운드"
  }
  if ($modelKey.Contains("IMAGE이미지") -or ($modelKey.StartsWith("IMAGE") -and $modelKey.Contains("이미지"))) {
    Add-UniqueSearchKey $keys "IMAGE이미지"
  }

  foreach ($alias in (Get-ImageAliasKeys $model ($skuCodes -join " "))) {
    Add-UniqueSearchKey $keys $alias
  }

  return $keys.ToArray()
}

function Get-AsciiSlug([string]$value) {
  $slug = ($value.ToLowerInvariant() -replace "[^a-z0-9]+", "-").Trim("-")
  if ($slug) { return $slug }
  $fallback = Normalize-Key $value
  if ($fallback) { return ($fallback.ToLowerInvariant() -replace "[^a-z0-9]+", "-").Trim("-") }
  return "product"
}

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
      $strings.Add((Get-NodeText $item.t))
    } elseif ($item.r) {
      $parts = @()
      foreach ($run in $item.r) {
        if ($run.t) { $parts += (Get-NodeText $run.t) }
      }
      $strings.Add(($parts -join ""))
    } else {
      $strings.Add((Get-NodeText $item))
    }
  }
  return $strings.ToArray()
}

function Get-CellValue($cell, $sharedStrings) {
  $type = [string]$cell.t
  if ($type -eq "s") {
    $idx = [int](Get-NodeText $cell.v)
    if ($idx -ge 0 -and $idx -lt $sharedStrings.Count) { return $sharedStrings[$idx] }
    return ""
  }
  if ($type -eq "inlineStr") { return Get-NodeText $cell.is }
  return Get-NodeText $cell.v
}

function Read-XlsxSheets([string]$Path) {
  $zipHandle = Open-ZipReadShared $Path
  $zip = $zipHandle.Zip
  try {
    $shared = Get-SharedStrings $zip
    $workbookReader = New-Object System.IO.StreamReader($zip.GetEntry("xl/workbook.xml").Open())
    $relsReader = New-Object System.IO.StreamReader($zip.GetEntry("xl/_rels/workbook.xml.rels").Open())
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

    $sheets = @()
    foreach ($sheet in $workbook.workbook.sheets.sheet) {
      $rid = $sheet.GetAttribute("id", "http://schemas.openxmlformats.org/officeDocument/2006/relationships")
      $target = $relMap[$rid]
      if (-not $target) { continue }
      $sheetPath = Resolve-ZipTarget "xl" $target
      $entry = $zip.GetEntry($sheetPath)
      if (-not $entry) { continue }
      $reader = New-Object System.IO.StreamReader($entry.Open())
      try {
        [xml]$sheetXml = $reader.ReadToEnd()
      } finally {
        $reader.Dispose()
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
      $sheets += [pscustomobject]@{ Name = [string]$sheet.name; Rows = $rows }
    }
    return $sheets
  } finally {
    $zip.Dispose()
    $zipHandle.Stream.Dispose()
  }
}

function Get-EmbeddedImageMap([string]$Path, [int]$SheetIndex) {
  $map = @{}
  $zipHandle = Open-ZipReadShared $Path
  $zip = $zipHandle.Zip
  try {
    $sheetRelsEntry = $zip.GetEntry("xl/worksheets/_rels/sheet$SheetIndex.xml.rels")
    if (-not $sheetRelsEntry) { return $map }
    $sheetRelsReader = New-Object System.IO.StreamReader($sheetRelsEntry.Open())
    try {
      $sheetRelsXml = $sheetRelsReader.ReadToEnd()
    } finally {
      $sheetRelsReader.Dispose()
    }

    $drawingPaths = New-Object System.Collections.Generic.List[string]
    foreach ($match in [regex]::Matches($sheetRelsXml, '<Relationship\b[^>]*/?>')) {
      $relationshipText = [string]$match.Value
      $typeMatch = [regex]::Match($relationshipText, '\bType="([^"]+)"')
      $targetMatch = [regex]::Match($relationshipText, '\bTarget="([^"]+)"')
      if (-not $typeMatch.Success -or -not $targetMatch.Success) { continue }
      if ($typeMatch.Groups[1].Value -notlike "*relationships/drawing") { continue }
      $drawingPaths.Add((Resolve-ZipTarget "xl/worksheets" $targetMatch.Groups[1].Value))
    }

    foreach ($drawingPath in $drawingPaths) {
      $drawingEntry = $zip.GetEntry($drawingPath)
      if (-not $drawingEntry) { continue }
      $drawingReader = New-Object System.IO.StreamReader($drawingEntry.Open())
      try {
        $drawingXml = $drawingReader.ReadToEnd()
      } finally {
        $drawingReader.Dispose()
      }

      $drawingDir = $drawingPath.Substring(0, $drawingPath.LastIndexOf("/"))
      $drawingFile = $drawingPath.Substring($drawingPath.LastIndexOf("/") + 1)
      $relsPath = "$drawingDir/_rels/$drawingFile.rels"
      $relsEntry = $zip.GetEntry($relsPath)
      if (-not $relsEntry) { continue }
      $relsReader = New-Object System.IO.StreamReader($relsEntry.Open())
      try {
        $relsXml = $relsReader.ReadToEnd()
      } finally {
        $relsReader.Dispose()
      }

      $rels = @{}
      foreach ($match in [regex]::Matches($relsXml, '<Relationship\b[^>]*/?>')) {
        $relationshipText = [string]$match.Value
        $idMatch = [regex]::Match($relationshipText, '\bId="([^"]+)"')
        $targetMatch = [regex]::Match($relationshipText, '\bTarget="([^"]+)"')
        if (-not $idMatch.Success -or -not $targetMatch.Success) { continue }
        $target = Resolve-ZipTarget $drawingDir ([string]$targetMatch.Groups[1].Value)
        $rels[[string]$idMatch.Groups[1].Value] = $target
      }

      $anchorPattern = '<(?:\w+:)?(?:oneCellAnchor|twoCellAnchor)\b[\s\S]*?</(?:\w+:)?(?:oneCellAnchor|twoCellAnchor)>'
      foreach ($anchor in [regex]::Matches($drawingXml, $anchorPattern)) {
        $anchorText = [string]$anchor.Value
        $rowMatch = [regex]::Match($anchorText, '<(?:\w+:)?from>[\s\S]*?<(?:\w+:)?row>(\d+)</(?:\w+:)?row>')
        $embedMatch = [regex]::Match($anchorText, 'r:embed="([^"]+)"')
        if (-not $rowMatch.Success -or -not $embedMatch.Success) { continue }
        $row = [int]$rowMatch.Groups[1].Value
        $rid = [string]$embedMatch.Groups[1].Value
        if ($rels.ContainsKey($rid)) {
          $map[$row] = $rels[$rid]
        }
      }
    }
  } finally {
    $zip.Dispose()
    $zipHandle.Stream.Dispose()
  }
  return $map
}

function Copy-EmbeddedImage([string]$WorkbookPath, [string]$EntryPath, [string]$DestinationPath) {
  $zipHandle = Open-ZipReadShared $WorkbookPath
  $zip = $zipHandle.Zip
  try {
    $entry = $zip.GetEntry($EntryPath)
    if (-not $entry) { return $false }
    $stream = $entry.Open()
    try {
      $output = [System.IO.File]::Create($DestinationPath)
      try {
        $stream.CopyTo($output)
      } finally {
        $output.Dispose()
      }
    } finally {
      $stream.Dispose()
    }
    return $true
  } finally {
    $zip.Dispose()
    $zipHandle.Stream.Dispose()
  }
}

function Get-HeaderMap($headerRow) {
  $map = @{}
  for ($i = 0; $i -lt $headerRow.Count; $i++) {
    $name = Normalize-Text $headerRow[$i]
    if ($name) { $map[$name] = $i }
  }
  return $map
}

function Get-ByHeader($row, $headers, [string[]]$names) {
  foreach ($name in $names) {
    if ($headers.ContainsKey($name)) {
      $idx = $headers[$name]
      if ($idx -lt $row.Count) { return [string]$row[$idx] }
    }
  }
  return ""
}

function Parse-Price([string]$value) {
  $digits = ($value -replace "[^0-9]", "")
  if (-not $digits) { return $null }
  return [int]$digits
}

function Extract-SkuCodes([string]$value) {
  if ([string]::IsNullOrWhiteSpace($value)) { return @() }
  $upper = $value.ToUpperInvariant()
  $matches = [regex]::Matches($upper, "[A-Z0-9]+(?:[-_][A-Z0-9]+)*")
  $skip = @("품번", "도기", "하부", "탱크", "시트커버", "시트", "반다리", "긴다리", "하부선반", "ABS")
  $codes = New-Object System.Collections.Generic.List[string]
  foreach ($match in $matches) {
    $code = ([string]$match.Value).Trim("-_")
    if ($skip -contains $code) { continue }
    if ($code.Length -lt 3) { continue }
    if ($code -notmatch "\d") { continue }
    $code = $code -replace "_", "-"
    if (-not $codes.Contains($code)) { $codes.Add($code) }
  }
  return $codes.ToArray()
}

function Get-CategorySpec([string]$serviceCode, [string]$sheetName) {
  $sheetKey = $sheetName -replace "\s+", ""
  if ($sheetKey -in @("전체", "원본정보", "종합비교", "현장가이드", "결정가이드")) {
    return $null
  }
  if ($serviceCode -eq "toilet_replace") {
    if ($sheetKey -like "*투피스*") {
      return @{ Id = "two-piece"; Name = "투피스"; Summary = "탱크와 본체가 분리된 일반형입니다. 부속 수급과 A/S가 쉽고 기본 교체에 적합합니다."; Hint = "가격·부속 호환·빠른 교체 우선" }
    }
    if ($sheetKey -like "*원피스*") {
      return @{ Id = "one-piece"; Name = "원피스"; Summary = "탱크와 본체가 일체형인 모델입니다. 외관이 깔끔하고 욕실 분위기를 정리하기 좋습니다."; Hint = "디자인·청소 편의·일체형 선호" }
    }
  }
  if ($serviceCode -eq "basin_replace") {
    if ($sheetKey -like "*긴다리*") {
      return @{ Id = "full-pedestal"; Name = "긴다리 세면기"; Summary = "하부 배관을 길게 가리는 기본형 세면기입니다. 기존 긴다리 타입 교체에 적합합니다."; Hint = "하부 배관 노출 최소화" }
    }
    return @{ Id = "half-pedestal"; Name = "반다리 세면기"; Summary = "일반 욕실에서 많이 쓰는 반다리형 세면기입니다. 벽 배관 조건을 확인해 선택합니다."; Hint = "일반 욕실·반다리 교체" }
  }
  if ($serviceCode -eq "faucet_replace") {
    if ($sheetKey -like "*레인샤워*") {
      return @{ Id = "rain-shower-faucet"; Name = "레인샤워수전"; Summary = "상부 샤워 헤드와 수전이 함께 구성된 레인샤워 타입입니다."; Hint = "레인샤워 구성 교체" }
    }
    if ($sheetKey -like "*샤워욕조*" -or $sheetKey -like "*욕조수전*") {
      return @{ Id = "bath-shower-faucet"; Name = "샤워욕조 수전"; Summary = "욕조 토수와 샤워를 함께 쓰는 벽붙이 수전입니다."; Hint = "욕조 겸용 수전 교체" }
    }
    if ($sheetKey -like "*샤워수전*") {
      return @{ Id = "shower-faucet"; Name = "샤워수전"; Summary = "샤워 전용 벽붙이 수전입니다. 기존 배관 간격과 색상 옵션을 확인합니다."; Hint = "샤워 전용 수전 교체" }
    }
    if ($sheetKey -like "*주방*") {
      return @{ Id = "kitchen-faucet"; Name = "주방수전"; Summary = "싱크대 상판 또는 싱크볼에 설치하는 주방 수전입니다."; Hint = "주방 싱크대 수전 교체" }
    }
    return @{ Id = "basin-faucet"; Name = "세면수전"; Summary = "세면대에 설치하는 원홀·탑볼 수전입니다. 색상과 타공 조건을 확인합니다."; Hint = "세면대 수전 교체" }
  }
  if ($serviceCode -eq "bidet_install") {
    return @{ Id = "bidet"; Name = "비데"; Summary = "기존 양변기에 설치하는 전자식 비데입니다. 전원 콘센트와 급수 밸브 위치를 확인합니다."; Hint = "비데 신규 설치·교체" }
  }
  if ($serviceCode -eq "ventilator_replace") {
    return @{ Id = "bathroom-ventilator"; Name = "욕실 환풍기"; Summary = "욕실 천장에 설치하는 환풍기·복합 환기 제품입니다. 타공 크기, 전원, 기능 구성을 확인합니다."; Hint = "욕실 환풍기 교체" }
  }
  if ($serviceCode -eq "sash_handle") {
    if ($sheetKey -like "*잠금장치*" -or $sheetKey -like "*부자재*") {
      return $null
    }
    if ($sheetKey -like "*확인필요*") {
      return $null
    }
    return @{ Id = "sash-handle"; Name = "샷시 손잡이"; Summary = "창호에 설치하는 샷시 손잡이입니다. 기존 손잡이 크기, 잠금장치 타입, 피스 간격을 확인해 선택합니다."; Hint = "창호 손잡이 교체" }
  }
  if ($serviceCode -eq "door_handle") {
    return @{ Id = "door-handle"; Name = "도어핸들"; Summary = "방문에 설치하는 도어핸들입니다. 기존 문 두께, 잠금 방식, 레버 규격을 확인해 선택합니다."; Hint = "방문 손잡이 교체" }
  }
  if ($serviceCode -eq "silicone_repair") {
    return @{ Id = "silicone"; Name = "실리콘"; Summary = "욕실·주방·창호 주변 마감에 사용하는 실리콘입니다. 기존 실리콘 제거 범위와 색상 호환을 확인해 선택합니다."; Hint = "실리콘 색상·마감 교체" }
  }
  if ($serviceCode -eq "bath_accessory") {
    return @{ Id = "bath-accessory-set"; Name = "욕실 악세서리 세트"; Summary = "수건걸이, 휴지걸이, 컵대, 비누대 등 여러 악세서리를 한 번에 구성하는 세트입니다."; Hint = "여러 부위를 한 번에 교체할 때 세트 시공비로 계산합니다." }
  }
  return $null
}

function Get-BathAccessoryCategorySpec([string]$model, [string]$feature) {
  $text = Normalize-Text "$model $feature"
  if ($text -match "(세트|[0-9]\s*종|액세서리|악세서리)") {
    return @{ Id = "bath-accessory-set"; Name = "욕실 악세서리 세트"; Summary = "수건걸이, 휴지걸이, 컵대, 비누대 등 여러 악세서리를 한 번에 구성하는 세트입니다."; Hint = "여러 부위를 한 번에 교체할 때 세트 시공비로 계산합니다." }
  }
  return @{ Id = "shelf-towel"; Name = "선반 및 수건걸이"; Summary = "수건걸이, 선반, 휴지걸이처럼 단품으로 고정하는 욕실 악세서리입니다."; Hint = "설치 위치와 기존 타공 위치가 맞으면 단품 교체로 진행합니다." }
}

function Get-ServiceCodeForWorkbook([string]$fileName) {
  if ($fileName -like "*양변기*") { return "toilet_replace" }
  if ($fileName -like "*세면기*") { return "basin_replace" }
  if ($fileName -like "*수전*") { return "faucet_replace" }
  if ($fileName -like "*비데*") { return "bidet_install" }
  if ($fileName -like "*환풍기*") { return "ventilator_replace" }
  if ($fileName -like "*샷시*손잡이*" -or $fileName -like "*샷시손잡이*") { return "sash_handle" }
  if ($fileName -like "*도어핸들*" -or $fileName -like "*도어*손잡이*" -or $fileName -like "*방문*손잡이*") { return "door_handle" }
  if ($fileName -like "*실리콘*") { return "silicone_repair" }
  if ($fileName -like "*액세서리*" -or $fileName -like "*악세서리*") { return "bath_accessory" }
  return $null
}

function Get-ServiceAssetDir([string]$serviceCode) {
  if ($serviceCode -eq "toilet_replace") { return "toilets" }
  if ($serviceCode -eq "basin_replace") { return "basins" }
  if ($serviceCode -eq "faucet_replace") { return "faucets" }
  if ($serviceCode -eq "bidet_install") { return "bidets" }
  if ($serviceCode -eq "ventilator_replace") { return "ventilators" }
  if ($serviceCode -eq "sash_handle") { return "sash-handles" }
  if ($serviceCode -eq "door_handle") { return "door-handles" }
  if ($serviceCode -eq "silicone_repair") { return "silicones" }
  if ($serviceCode -eq "bath_accessory") { return "accessories" }
  return "misc"
}

function Build-Note([string]$size, [string]$color, [string]$feature, [string]$doorThickness = "", [bool]$PreserveFeatureLines = $false) {
  $parts = New-Object System.Collections.Generic.List[string]
  $cleanColor = Normalize-Text $color
  $cleanSize = Normalize-Text $size
  $cleanFeature = if ($PreserveFeatureLines) { Normalize-MultilineText $feature } else { Normalize-Text $feature }
  $cleanDoorThickness = Normalize-Text $doorThickness
  if ($cleanColor -and $cleanColor -ne "-") { $parts.Add("색상 $cleanColor") }
  if ($cleanDoorThickness -and $cleanDoorThickness -ne "-") { $parts.Add("문두께 $cleanDoorThickness") }
  if ($cleanSize -and $cleanSize -ne "-") { $parts.Add("사이즈 $cleanSize") }
  if ($cleanFeature -and $cleanFeature -ne "-") { $parts.Add($cleanFeature) }
  if ($PreserveFeatureLines -and $cleanFeature) {
    return ($parts.ToArray() -join "`n")
  }
  return ($parts.ToArray() -join ", ")
}

function Get-ImageCandidates([string]$sourceDir) {
  Get-ChildItem -LiteralPath $sourceDir -Recurse -File |
    Where-Object { $_.Extension -match "^\.(jpg|jpeg|png|webp)$" -and $_.Name -ne ".DS_Store" } |
    ForEach-Object {
      $brandRoot = $_.FullName.Substring($sourceDir.Length).TrimStart("\").Split("\")[0]
      [pscustomobject]@{
        FullName = $_.FullName
        BrandRoot = $brandRoot
        NameKey = Normalize-Key $_.BaseName
        PathKey = Normalize-Key $_.FullName.Substring($sourceDir.Length)
      }
    }
}

function Find-ProductImage($imageCandidates, [string]$serviceCode, [string]$brandRoot, [string]$sheetName, [string]$model, [string[]]$skuCodes, [string]$color = "") {
  $brandImages = @($imageCandidates | Where-Object { $_.BrandRoot -eq $brandRoot })
  if ($brandImages.Count -eq 0) { return $null }
  $sheetKey = Normalize-Key $sheetName
  if ($sheetKey) {
    $sheetImages = @($brandImages | Where-Object { $_.PathKey.Contains($sheetKey) })
    if ($sheetImages.Count -gt 0) { $brandImages = $sheetImages }
  }
  $modelKey = Normalize-Key $model
  $colorKey = Normalize-Key $color
  if ($colorKey -eq "다크그레이") { $colorKey = "다크크레이" }
  $looseModelKey = Normalize-ImageModelKey $model
  $strictImageMatch = $serviceCode -eq "sash_handle"
  $modelTokens = [regex]::Matches($model.ToUpperInvariant(), "[A-Z0-9]{3,}") | ForEach-Object { [string]$_.Value } | Where-Object { $_ -notmatch "^[0-9]+$" }
  $aliasKeys = @(Get-ImageAliasKeys $model ($skuCodes -join " "))
  $imageSearchKeys = @(Get-ImageSearchKeys $model $skuCodes)
  $knownColorKeys = @("크롬", "사틴헤어라인", "사틴무광", "사틴", "그라파이트", "블랙", "화이트", "니켈", "건메탈", "브라운", "아이보리", "실버", "그레이", "블루", "핑크", "옐로우", "엘로우", "다크그레이", "다크크레이")
  $best = $null
  $bestScore = 0
  $bestIdentityScore = 0
  foreach ($image in $brandImages) {
    $score = 0
    $identityScore = 0
    $looseImageKey = Normalize-ImageModelKey $image.NameKey
    foreach ($code in $skuCodes) {
      $codeKey = Normalize-Key $code
      if ($codeKey -and ($image.NameKey.Contains($codeKey) -or $image.PathKey.Contains($codeKey))) {
        $score += 160
        $identityScore += 160
      }
    }
    foreach ($aliasKey in $aliasKeys) {
      if ($aliasKey -and ($image.NameKey.Contains($aliasKey) -or $image.PathKey.Contains($aliasKey))) {
        $score += 170
        $identityScore += 170
      }
    }
    foreach ($searchKey in $imageSearchKeys) {
      if ($searchKey -and ($image.NameKey.Contains($searchKey) -or $image.PathKey.Contains($searchKey))) {
        $points = if ($searchKey -match "[가-힣]{2,}[A-Z]$") { 150 } elseif ($searchKey -match "^[가-힣]{2,}$") { 70 } elseif ($searchKey.Length -ge 8) { 120 } elseif ($searchKey.Length -ge 6) { 90 } elseif ($searchKey.Length -ge 4) { 60 } else { 40 }
        $score += $points
        $identityScore += $points
      }
    }
    if ($modelKey -and $image.NameKey.Length -ge 4 -and ($modelKey.Contains($image.NameKey) -or $image.NameKey.Contains($modelKey))) {
      $score += 100
      $identityScore += 100
    }
    if ($modelKey -and $image.PathKey.Length -ge 4 -and ($modelKey.Contains($image.PathKey) -or $image.PathKey.Contains($modelKey))) {
      $score += 80
      $identityScore += 80
    }
    if ($colorKey -and $image.NameKey -eq $colorKey) { $score += 90 }
    elseif ($colorKey -and $image.PathKey.Contains($colorKey)) { $score += 65 }
    foreach ($knownColorKey in $knownColorKeys) {
      if ($colorKey -and $image.PathKey.Contains($knownColorKey) -and -not ($colorKey.Contains($knownColorKey) -or $knownColorKey.Contains($colorKey))) {
        $score -= 70
      }
    }
    if ($serviceCode -eq "silicone_repair" -and $colorKey -and $image.PathKey.Contains($colorKey)) { $identityScore += 120 }
    if ($looseModelKey -and $looseImageKey.Length -ge 3 -and ($looseModelKey.Contains($looseImageKey) -or $looseImageKey.Contains($looseModelKey))) {
      $score += 80
      $identityScore += 80
    }
    if ($sheetKey -and $image.PathKey.Contains($sheetKey) -and -not $strictImageMatch) { $score += 20 }
    foreach ($token in $modelTokens) {
      $tokenKey = Normalize-Key $token
      if ($tokenKey.Length -ge 5 -and ($image.NameKey.Contains($tokenKey) -or $image.PathKey.Contains($tokenKey))) {
        $score += 80
        $identityScore += 80
      }
      elseif ($tokenKey.Length -ge 4 -and ($image.NameKey.Contains($tokenKey) -or $image.PathKey.Contains($tokenKey))) {
        $score += 45
        $identityScore += 45
      }
    }
    if ($score -gt $bestScore -or ($score -eq $bestScore -and $identityScore -gt $bestIdentityScore)) {
      $best = $image
      $bestScore = $score
      $bestIdentityScore = $identityScore
    }
  }
  if ($strictImageMatch -and $bestScore -lt 30) { return $null }
  if (-not $strictImageMatch -and $bestScore -lt 60) { return $null }
  if (-not $strictImageMatch -and $serviceCode -ne "silicone_repair" -and $bestIdentityScore -lt 45) { return $null }
  return $best.FullName
}

function Reset-AssetDir([string]$dir) {
  $root = [System.IO.Path]::GetFullPath($publicProductsDir)
  $target = [System.IO.Path]::GetFullPath($dir)
  if (-not $target.StartsWith($root, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Refusing to clear path outside public products: $target"
  }
  if (Test-Path -LiteralPath $target) {
    Remove-Item -LiteralPath $target -Recurse -Force
  }
  New-Item -ItemType Directory -Path $target -Force | Out-Null
}

$imageCandidates = @(Get-ImageCandidates $SourceDir)
$serviceAssetDirs = @("toilets", "basins", "faucets", "bidets", "ventilators", "sash-handles", "door-handles", "silicones", "accessories")
foreach ($assetDir in $serviceAssetDirs) {
  Reset-AssetDir (Join-Path $publicProductsDir $assetDir)
}

$toiletProducts = New-Object System.Collections.Generic.List[object]
$replacementProducts = New-Object System.Collections.Generic.List[object]
$missingImages = New-Object System.Collections.Generic.List[object]
$counts = @{}
$sequenceByService = @{}

$workbooks = Get-ChildItem -LiteralPath $SourceDir -Recurse -Filter *.xlsx | Sort-Object FullName
foreach ($workbookFile in $workbooks) {
  $serviceCode = Get-ServiceCodeForWorkbook $workbookFile.Name
  if (-not $serviceCode) { continue }
  $brandRoot = $workbookFile.Directory.Name
  $sheets = Read-XlsxSheets $workbookFile.FullName
  for ($sheetIndex = 0; $sheetIndex -lt $sheets.Count; $sheetIndex++) {
    $sheet = $sheets[$sheetIndex]
    $embeddedImageMap = Get-EmbeddedImageMap $workbookFile.FullName ($sheetIndex + 1)
    if ($sheet.Rows.Count -lt 2) { continue }
    $category = Get-CategorySpec $serviceCode $sheet.Name
    if (-not $category) { continue }
    $headers = Get-HeaderMap $sheet.Rows[0]
    for ($rowIndex = 1; $rowIndex -lt $sheet.Rows.Count; $rowIndex++) {
      $row = $sheet.Rows[$rowIndex]
      $brand = Normalize-Brand (Get-ByHeader $row $headers @("브랜드"))
      $model = Normalize-Text (Get-ByHeader $row $headers @("품명"))
      $skuRaw = Get-ByHeader $row $headers @("품번", "품번/규격", "규격")
      $size = Get-ByHeader $row $headers @("사이즈", "사이즈(W*D*H)", "사이즈(D*W*H)", "사이즈(L*W*H)", "사이즈(mm)", "고정핀 중심 사이즈(mm)")
      $color = Get-ByHeader $row $headers @("색상", "컬러")
      $doorThickness = Get-ByHeader $row $headers @("문두께", "문 두께")
      $feature = Get-ByHeader $row $headers @("특징")
      $price = Parse-Price (Get-ByHeader $row $headers @("온라인 최저가", "단가", "제조사단가"))
      if (-not $brand -or -not $model) { continue }
      if ($serviceCode -eq "basin_replace" -and (Normalize-Key "$model $skuRaw").Contains("CL1500")) { continue }
      if ($serviceCode -eq "bath_accessory") { $category = Get-BathAccessoryCategorySpec $model $feature }
      $skuCodes = @(Extract-SkuCodes $skuRaw)
      $sku = if ($skuCodes.Count -gt 0) { $skuCodes -join " / " } else { Normalize-Text $skuRaw }
      if (-not $sku) { $sku = "-" }
      if (-not $sequenceByService.ContainsKey($serviceCode)) { $sequenceByService[$serviceCode] = 0 }
      $sequenceByService[$serviceCode] = [int]$sequenceByService[$serviceCode] + 1
      $sequence = [int]$sequenceByService[$serviceCode]
      $primaryCode = if ($skuCodes.Count -gt 0) { $skuCodes[0] } else { $model }
      $slug = Get-AsciiSlug $primaryCode
      $categoryId = [string]$category.Id
      $productId = "${serviceCode}:${categoryId}:$($sequence.ToString("00")):$slug"
      $assetDir = Get-ServiceAssetDir $serviceCode
      $fileSlug = "$($serviceCode -replace "_", "-")-$($sequence.ToString("000"))-$slug"
      $embeddedEntryPath = if ($embeddedImageMap.ContainsKey($rowIndex)) { [string]$embeddedImageMap[$rowIndex] } else { $null }
      $preferEmbeddedImage = $serviceCode -eq "sash_handle" -and $embeddedEntryPath
      $sourceImage = if ($preferEmbeddedImage) { $null } else { Find-ProductImage $imageCandidates $serviceCode $brandRoot $sheet.Name $model $skuCodes $color }
      $imagePath = $null
      if ($preferEmbeddedImage) {
        $ext = ([System.IO.Path]::GetExtension($embeddedEntryPath)).ToLowerInvariant()
        if (-not $ext) { $ext = ".png" }
        if ($ext -eq ".jpeg") { $ext = ".jpg" }
        $destFile = Join-Path (Join-Path $publicProductsDir $assetDir) ($fileSlug + $ext)
        if (Copy-EmbeddedImage $workbookFile.FullName $embeddedEntryPath $destFile) {
          $imagePath = "/products/$assetDir/$fileSlug$ext"
        }
      } elseif ($sourceImage) {
        $ext = ([System.IO.Path]::GetExtension($sourceImage)).ToLowerInvariant()
        if ($ext -eq ".jpeg") { $ext = ".jpg" }
        $destFile = Join-Path (Join-Path $publicProductsDir $assetDir) ($fileSlug + $ext)
        Copy-Item -LiteralPath $sourceImage -Destination $destFile -Force
        $imagePath = "/products/$assetDir/$fileSlug$ext"
      } elseif ($embeddedEntryPath) {
        $ext = ([System.IO.Path]::GetExtension($embeddedEntryPath)).ToLowerInvariant()
        if (-not $ext) { $ext = ".png" }
        if ($ext -eq ".jpeg") { $ext = ".jpg" }
        $destFile = Join-Path (Join-Path $publicProductsDir $assetDir) ($fileSlug + $ext)
        if (Copy-EmbeddedImage $workbookFile.FullName $embeddedEntryPath $destFile) {
          $imagePath = "/products/$assetDir/$fileSlug$ext"
        }
      } else {
        $missingImages.Add([pscustomobject]@{
          Service = $serviceCode
          Workbook = $workbookFile.Name
          Sheet = $sheet.Name
          Model = $model
          Sku = $sku
        })
      }
      $cleanColor = Normalize-Text $color
      $cleanSize = Normalize-Text $size
      $product = [ordered]@{
        id = $productId
        serviceCode = $serviceCode
        categoryId = $categoryId
        categoryName = [string]$category.Name
        categorySummary = [string]$category.Summary
        decisionHint = [string]$category.Hint
        brand = $brand
        name = $model
        model = $model
        sku = $sku
        color = $cleanColor
        size = $cleanSize
        price = $price
        note = Build-Note $size $color $feature $doorThickness ($serviceCode -eq "ventilator_replace")
        popular = $false
        image = $imagePath
        sourceImageFile = if ($sourceImage) { [System.IO.Path]::GetFileName($sourceImage) } elseif ($embeddedEntryPath) { [System.IO.Path]::GetFileName($embeddedEntryPath) } else { "" }
        sourceWorkbook = $workbookFile.Name
        sourceSheet = if ($serviceCode -eq "silicone_repair") { "실리콘" } else { $sheet.Name }
        sourceRow = $rowIndex + 1
      }
      if (-not $counts.ContainsKey($serviceCode)) { $counts[$serviceCode] = 0 }
      $counts[$serviceCode] = [int]$counts[$serviceCode] + 1
      if ($serviceCode -eq "toilet_replace") {
        $toiletProduct = [ordered]@{
          id = $product.id
          categoryId = $product.categoryId
          categoryName = $product.categoryName
          categorySummary = $product.categorySummary
          decisionHint = $product.decisionHint
          brand = $product.brand
          name = $product.name
          model = $product.model
          sku = $product.sku
          color = $product.color
          size = $product.size
          price = $product.price
          note = $product.note
          popular = $product.popular
          image = $product.image
          sourceSheet = $product.sourceSheet
          sourceRow = $product.sourceRow
        }
        $toiletProducts.Add($toiletProduct)
      } else {
        $replacementProducts.Add($product)
      }
    }
  }
}

$jsonOptions = @{ Depth = 20 }
($toiletProducts.ToArray() | ConvertTo-Json @jsonOptions) | Set-Content -LiteralPath $toiletJsonPath -Encoding UTF8
($replacementProducts.ToArray() | ConvertTo-Json @jsonOptions) | Set-Content -LiteralPath $replacementJsonPath -Encoding UTF8

[pscustomobject]@{
  Counts = $counts
  ToiletProducts = $toiletProducts.Count
  ReplacementProducts = $replacementProducts.Count
  MissingImageCount = $missingImages.Count
  MissingImageSamples = @($missingImages | Select-Object -First 20)
  OutputFiles = @($toiletJsonPath, $replacementJsonPath)
} | ConvertTo-Json -Depth 8
