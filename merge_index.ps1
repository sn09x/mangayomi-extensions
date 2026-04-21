# Extract and merge all sources into index.json
$anime = Get-Content -Raw 'anime_index.json' | ConvertFrom-Json
$novel = Get-Content -Raw 'novel_index.json' | ConvertFrom-Json

# Extract JS sources
$jsFiles = Get-ChildItem -Recurse -Filter "*.js" -Path "javascript" | Select-Object -ExpandProperty FullName
$jsSources = @()

foreach ($file in $jsFiles) {
    $content = Get-Content -Raw $file
    $startIdx = $content.IndexOf('[')
    $endIdx = $content.LastIndexOf(']')
    
    if ($startIdx -ge 0 -and $endIdx -gt $startIdx) {
        try {
            $jsonStr = $content.Substring($startIdx, $endIdx - $startIdx + 1)
            $sources = $jsonStr | ConvertFrom-Json
            
            foreach ($src in @($sources)) {
                if ($src) {
                    # Add pkgPath if missing
                    if (-not $src.pkgPath) {
                        $pkgPath = $file -replace '^[A-Z]:\\.*?\\mangayomi-extensions\\', '' -replace '\\', '/'
                        $src | Add-Member -NotePropertyName pkgPath -NotePropertyValue $pkgPath -Force
                    }
                    $jsSources += $src
                }
            }
        } catch {
            Write-Warning "Error parsing $file : $_"
        }
    }
}

# Merge all sources
$all = @($anime) + @($novel) + @($jsSources) | Where-Object { $_ -ne $null }

# Save to index.json
$all | ConvertTo-Json -Depth 10 | Set-Content 'index.json'

Write-Host "✓ index.json merged successfully"
Write-Host "Total sources: $($all.Count)"
Write-Host "  - Anime: $(($anime | Measure-Object).Count)"
Write-Host "  - Novel: $(($novel | Measure-Object).Count)"
Write-Host "  - JS: $($jsSources.Count)"
