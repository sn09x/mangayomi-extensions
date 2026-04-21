# Extract only manga JS sources and build index.json
$jsFiles = Get-ChildItem -Recurse -Filter "*.js" -Path "javascript/manga" | Select-Object -ExpandProperty FullName
$mangaSources = @()

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
                    # Ensure pkgPath is set
                    $pkgPath = $file -replace '^[A-Z]:\\.*?\\mangayomi-extensions\\', '' -replace '\\', '/'
                    if ($src.pkgPath) {
                        $src.pkgPath = $pkgPath
                    } else {
                        $src | Add-Member -NotePropertyName pkgPath -NotePropertyValue $pkgPath -Force
                    }
                    $mangaSources += $src
                }
            }
        } catch {
            Write-Warning "Error parsing $file : $_"
        }
    }
}

# Save to index.json
$mangaSources | ConvertTo-Json -Depth 10 | Set-Content 'index.json'

Write-Host "✓ index.json created with manga JS sources only"
Write-Host "Total manga sources: $($mangaSources.Count)"
$mangaSources | Select-Object name, lang, baseUrl | Format-Table
