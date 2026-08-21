@echo off
cd /d "%~dp0"
echo Starting Jira proxy... keep this window open while using Joby.
python jira-proxy.py
pause
