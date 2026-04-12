chcp 65001 > $null
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
git config user.name "seren"
git config user.email "develop@serendipy.jp"
Write-Host "会社アカウント設定完了: $(git config user.email)" -ForegroundColor Green
