$lines = Get-Content wsdl.xml
Write-Output "--- Context around line 29 (BankAccounts) ---"
for ($i = 18; $i -le 35; $i++) { Write-Output "$($i+1): $($lines[$i])" }
Write-Output ""
Write-Output "--- Context around line 404 (BankAccounts) ---"
for ($i = 390; $i -le 410; $i++) { Write-Output "$($i+1): $($lines[$i])" }