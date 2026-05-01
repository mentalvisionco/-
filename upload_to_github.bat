@echo off
chcp 65001 > nul
set GIT="C:\Program Files\Git\cmd\git.exe"

echo === اداة الرفع التلقائي على GitHub ===
echo.
set /p repo_url="ضع رابط المستودع هنا (مثال: https://github.com/mentalvisionco/lms.git) ثم اضغط Enter: "

%GIT% init
%GIT% add .
%GIT% commit -m "First Commit - LMS Project"
%GIT% branch -M main
%GIT% remote add origin %repo_url%
%GIT% push -u origin main -f

echo.
echo تم الرفع بنجاح! يمكنك الآن الذهاب إلى Railway للبدء.
pause
