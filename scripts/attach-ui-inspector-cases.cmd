@echo off
cd /d "C:\Users\user\Documents\New project"
set UI_INSPECTOR_TARGET_URL=http://127.0.0.1:3000/cases
if not exist ".runtime\logs" mkdir ".runtime\logs"
node scripts\attach-ui-inspector.mjs > .runtime\logs\ui-inspector-attach.out.log 2> .runtime\logs\ui-inspector-attach.err.log
