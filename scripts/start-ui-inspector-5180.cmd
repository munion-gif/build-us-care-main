@echo off
cd /d "C:\Users\user\Documents\New project"
if not exist ".runtime\logs" mkdir ".runtime\logs"
node scripts\run-ui-inspector-dev.mjs >> .runtime\logs\start-ui-inspector-cmd.log 2>&1
