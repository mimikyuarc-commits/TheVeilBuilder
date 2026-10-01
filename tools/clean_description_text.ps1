param([switch]$DryRun)

$databasePath = Join-Path $PSScriptRoot '..\js\database.js'
$lines = (Get-Content -Raw $databasePath) -split "`r?`n"
$changed = 0

for ($index = 0; $index -lt $lines.Count; $index++) {
    if ($lines[$index] -notmatch '^\s*"description"\s*:') { continue }

    $updated = $lines[$index]
    $updated = $updated -replace '\\"', ''
    $updated = $updated.Replace('“', '').Replace('”', '').Replace('‘', "'").Replace('’', "'")
    $updated = $updated.Replace('—', '-').Replace('–', '-')
    $updated = $updated -replace '[_`]', ''
    $updated = $updated -replace '[^\x00-\x7F]', ''
    $updated = $updated -replace '(:\s*" )', '$1'.Replace('" ', '"')
    if ($updated -ne $lines[$index]) {
        $lines[$index] = $updated
        $changed++
    }
}

if (-not $DryRun) {
    $encoding = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText((Resolve-Path $databasePath), ($lines -join "`r`n"), $encoding)
}

Write-Output "Description lines changed: $changed"