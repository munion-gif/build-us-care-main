param(
  [string]$SourceDir = "C:\Users\user\Desktop\build_us_care",
  [string]$ProjectRoot = (Resolve-Path ".").Path
)

$ErrorActionPreference = "Stop"
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

function Normalize-Brand([string]$value) {
  $brand = Normalize-Text $value
  if ($brand -replace "\s+", "" -eq "아메리칸스탠다드") { return "아메리칸스탠다드" }
  return $brand
}

function Normalize-Key([string]$value) {
  if ([string]::IsNullOrWhiteSpace($value)) { return "" }
  return (($value.ToUpperInvariant()) -replace "[^A-Z0-9가-힣]", "")
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
  $zip = [System.IO.Compression.ZipFile]::OpenRead($Path)
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
      $sheetPath = if ($target.StartsWith("/")) { $target.TrimStart("/") } else { "xl/$target" }
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
  }
}

function Get-EmbeddedImageMap([string]$Path) {
  $map = @{}
  $zip = [System.IO.Compression.ZipFile]::OpenRead($Path)
  try {
    $drawingEntries = @($zip.Entries | Where-Object { $_.FullName -match "^xl/drawings/drawing\d+\.xml$" })
    foreach ($drawingEntry in $drawingEntries) {
      $drawingReader = New-Object System.IO.StreamReader($drawingEntry.Open())
      try {
        $drawingXml = $drawingReader.ReadToEnd()
      } finally {
        $drawingReader.Dispose()
      }

      $relsPath = ($drawingEntry.FullName -replace "^xl/drawings/", "xl/drawings/_rels/") + ".rels"
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
        $target = [string]$targetMatch.Groups[1].Value
        if ($target.StartsWith("/")) { $target = $target.TrimStart("/") }
        elseif (-not $target.StartsWith("xl/")) { $target = "xl/drawings/$target" }
        $target = $target -replace "^xl/drawings/\.\./", "xl/"
        $rels[[string]$idMatch.Groups[1].Value] = $target
      }

      foreach ($anchor in [regex]::Matches($drawingXml, '<twoCellAnchor\b[\s\S]*?</twoCellAnchor>')) {
        $anchorText = [string]$anchor.Value
        $rowMatch = [regex]::Match($anchorText, '<from>[\s\S]*?<row>(\d+)</row>')
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
  }
  return $map
}

function Copy-EmbeddedImage([string]$WorkbookPath, [string]$EntryPath, [string]$DestinationPath) {
  $zip = [System.IO.Compression.ZipFile]::OpenRead($WorkbookPath)
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
  return $null
}

function Get-ServiceCodeForWorkbook([string]$fileName) {
  if ($fileName -like "*양변기*") { return "toilet_replace" }
  if ($fileName -like "*세면기*") { return "basin_replace" }
  if ($fileName -like "*수전*") { return "faucet_replace" }
  if ($fileName -like "*비데*") { return "bidet_install" }
  if ($fileName -like "*환풍기*") { return "ventilator_replace" }
  return $null
}

function Get-ServiceAssetDir([string]$serviceCode) {
  if ($serviceCode -eq "toilet_replace") { return "toilets" }
  if ($serviceCode -eq "basin_replace") { return "basins" }
  if ($serviceCode -eq "faucet_replace") { return "faucets" }
  if ($serviceCode -eq "bidet_install") { return "bidets" }
  if ($serviceCode -eq "ventilator_replace") { return "ventilators" }
  return "misc"
}

function Build-Note([string]$size, [string]$color, [string]$feature) {
  $parts = New-Object System.Collections.Generic.List[string]
  $cleanColor = Normalize-Text $color
  $cleanSize = Normalize-Text $size
  $cleanFeature = Normalize-Text $feature
  if ($cleanColor -and $cleanColor -ne "-") { $parts.Add("색상 $cleanColor") }
  if ($cleanSize -and $cleanSize -ne "-") { $parts.Add("사이즈 $cleanSize") }
  if ($cleanFeature -and $cleanFeature -ne "-") { $parts.Add($cleanFeature) }
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

function Find-ProductImage($imageCandidates, [string]$brandRoot, [string]$sheetName, [string]$model, [string[]]$skuCodes) {
  $brandImages = @($imageCandidates | Where-Object { $_.BrandRoot -eq $brandRoot })
  if ($brandImages.Count -eq 0) { return $null }
  $sheetKey = Normalize-Key $sheetName
  $modelTokens = [regex]::Matches($model.ToUpperInvariant(), "[A-Z0-9]{3,}") | ForEach-Object { [string]$_.Value } | Where-Object { $_ -notmatch "^[0-9]+$" }
  $best = $null
  $bestScore = 0
  foreach ($image in $brandImages) {
    $score = 0
    foreach ($code in $skuCodes) {
      $codeKey = Normalize-Key $code
      if ($codeKey -and ($image.NameKey.Contains($codeKey) -or $image.PathKey.Contains($codeKey))) { $score += 120 }
    }
    if ($sheetKey -and $image.PathKey.Contains($sheetKey)) { $score += 15 }
    foreach ($token in $modelTokens) {
      $tokenKey = Normalize-Key $token
      if ($tokenKey.Length -ge 3 -and ($image.NameKey.Contains($tokenKey) -or $image.PathKey.Contains($tokenKey))) { $score += 8 }
    }
    if ($score -gt $bestScore) {
      $best = $image
      $bestScore = $score
    }
  }
  if ($bestScore -le 0) { return $null }
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
$serviceAssetDirs = @("toilets", "basins", "faucets", "bidets", "ventilators")
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
  $embeddedImageMap = Get-EmbeddedImageMap $workbookFile.FullName
  foreach ($sheet in $sheets) {
    if ($sheet.Rows.Count -lt 2) { continue }
    $category = Get-CategorySpec $serviceCode $sheet.Name
    if (-not $category) { continue }
    $headers = Get-HeaderMap $sheet.Rows[0]
    for ($rowIndex = 1; $rowIndex -lt $sheet.Rows.Count; $rowIndex++) {
      $row = $sheet.Rows[$rowIndex]
      $brand = Normalize-Brand (Get-ByHeader $row $headers @("브랜드"))
      $model = Normalize-Text (Get-ByHeader $row $headers @("품명"))
      $skuRaw = Get-ByHeader $row $headers @("품번")
      $size = Get-ByHeader $row $headers @("사이즈", "사이즈(W*D*H)", "사이즈(D*W*H)", "사이즈(L*W*H)", "사이즈(mm)", "고정핀 중심 사이즈(mm)")
      $color = Get-ByHeader $row $headers @("색상", "컬러")
      $feature = Get-ByHeader $row $headers @("특징")
      $price = Parse-Price (Get-ByHeader $row $headers @("온라인 최저가"))
      if (-not $brand -or -not $model) { continue }
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
      $sourceImage = Find-ProductImage $imageCandidates $brandRoot $sheet.Name $model $skuCodes
      $imagePath = $null
      if ($sourceImage) {
        $ext = ([System.IO.Path]::GetExtension($sourceImage)).ToLowerInvariant()
        if ($ext -eq ".jpeg") { $ext = ".jpg" }
        $destFile = Join-Path (Join-Path $publicProductsDir $assetDir) ($fileSlug + $ext)
        Copy-Item -LiteralPath $sourceImage -Destination $destFile -Force
        $imagePath = "/products/$assetDir/$fileSlug$ext"
      } elseif ($embeddedImageMap.ContainsKey($rowIndex)) {
        $entryPath = [string]$embeddedImageMap[$rowIndex]
        $ext = ([System.IO.Path]::GetExtension($entryPath)).ToLowerInvariant()
        if (-not $ext) { $ext = ".png" }
        if ($ext -eq ".jpeg") { $ext = ".jpg" }
        $destFile = Join-Path (Join-Path $publicProductsDir $assetDir) ($fileSlug + $ext)
        if (Copy-EmbeddedImage $workbookFile.FullName $entryPath $destFile) {
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
      $product = [ordered]@{
        id = $productId
        serviceCode = $serviceCode
        categoryId = $categoryId
        categoryName = [string]$category.Name
        categorySummary = [string]$category.Summary
        decisionHint = [string]$category.Hint
        brand = $brand
        model = $model
        sku = $sku
        price = $price
        note = Build-Note $size $color $feature
        popular = $false
        image = $imagePath
        sourceWorkbook = $workbookFile.Name
        sourceSheet = $sheet.Name
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
          model = $product.model
          sku = $product.sku
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
