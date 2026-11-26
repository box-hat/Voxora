@echo off
rem Windows shortcut. The real script is scripts\dev.mjs.
rem   dev.cmd          -^> https://localhost:4200
rem   dev.cmd --lan    -^> also reachable from other devices
cd /d "%~dp0"
node scripts\dev.mjs %*
