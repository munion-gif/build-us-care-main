$ErrorActionPreference = "Stop"
Set-Location "C:\Users\user\Documents\New project"
$env:UI_INSPECTOR_TARGET_URL = "http://127.0.0.1:3000/cases"
node scripts\attach-ui-inspector.mjs *> ui-inspector-attach.out.log
