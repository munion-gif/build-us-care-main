@echo off
cd /d "C:\Users\user\Documents\New project"
set UI_INSPECTOR_TARGET_URL=http://127.0.0.1:3000/cases
node scripts\attach-ui-inspector.mjs > ui-inspector-attach.out.log 2> ui-inspector-attach.err.log
