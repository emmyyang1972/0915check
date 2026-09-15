param(
  [string]$IndexPath = '.\data\index.json',
  [string]$OutputPath = '.\data\content-samples.json',
  [int]$Limit = 0
)

$ErrorActionPreference = 'Stop'
$index = Get-Content -Raw -Encoding UTF8 -LiteralPath $IndexPath | ConvertFrom-Json
$docs = @($index.documents | Where-Object { $_.jurisdiction -eq 'UNKNOWN' -and $_.extension -in @('doc','docx','docm','pdf') })
if ($Limit -gt 0) { $docs = @($docs | Select-Object -First $Limit) }

$word = New-Object -ComObject Word.Application
$word.Visible = $false
$word.DisplayAlerts = 0
$results = New-Object System.Collections.Generic.List[object]
$done = 0

foreach ($doc in $docs) {
  $item = [ordered]@{
    documentId = $doc.documentId
    fileName = $doc.fileName
    relativePath = $doc.relativePath
    extracted = $false
    textSample = ''
    error = ''
  }
  $document = $null
  try {
    $document = $word.Documents.Open($doc.absolutePath, $false, $true, $false, $null, $null, $false, $null, $null, 0, $false, $false)
    $text = $document.Content.Text
    if ($null -ne $text) {
      $text = $text -replace '[\x00-\x08\x0B\x0C\x0E-\x1F]', ' '
      $item.textSample = $text.Substring(0, [Math]::Min(5000, $text.Length)).Trim()
      $item.extracted = $item.textSample.Length -gt 0
    }
  } catch {
    $item.error = $_.Exception.Message
  } finally {
    if ($null -ne $document) { $document.Close($false) | Out-Null; [void][Runtime.InteropServices.Marshal]::ReleaseComObject($document) }
  }
  $results.Add([PSCustomObject]$item)
  $done++
  if (($done % 25) -eq 0) { Write-Output ("processed=" + $done + "/" + $docs.Count) }
}

$word.Quit()
[void][Runtime.InteropServices.Marshal]::ReleaseComObject($word)
$results | ConvertTo-Json -Depth 4 | Set-Content -Encoding UTF8 -LiteralPath $OutputPath
Write-Output ("extracted=" + (($results | Where-Object extracted).Count) + "; failed=" + (($results | Where-Object { -not $_.extracted }).Count) + "; output=" + $OutputPath)
