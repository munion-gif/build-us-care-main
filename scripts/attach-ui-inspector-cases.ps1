$ErrorActionPreference = "Stop"
Set-Location "C:\Users\user\Documents\New project"
$env:UI_INSPECTOR_TARGET_URL = "http://127.0.0.1:3000/cases"
New-Item -ItemType Directory -Force -Path ".runtime\logs" | Out-Null
node scripts\attach-ui-inspector.mjs *> ".runtime\logs\ui-inspector-attach.out.log"
