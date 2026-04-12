chcp 65001 > $null
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
git config user.name "takayanagi"
git config user.email "k.takayanagi@serendipy.jp"
Write-Host "個人アカウント設定完了: $(git config user.email)" -ForegroundColor Green
