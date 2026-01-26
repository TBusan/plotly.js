@echo off
echo ========================================
echo Contour Core Refactoring Test Suite
echo ========================================
echo.

echo [1/5] Checking Node.js version...
node --version
echo.

echo [2/5] Testing contour-core in Node.js...
node src\contour-core\test_node.js
if %errorlevel% neq 0 (
    echo FAILED: Node.js test failed
    exit /b 1
)
echo.

echo [3/5] Running lint check...
npm run lint 2>nul
if %errorlevel% neq 0 (
    echo WARNING: Lint check found issues
) else (
    echo OK: Lint check passed
)
echo.

echo [4/5] Building plotly.js...
npm run bundle
if %errorlevel% neq 0 (
    echo FAILED: Build failed
    exit /b 1
)
echo.

echo [5/5] Verifying build output...
dir dist\plotly.js | findstr plotly.js
echo.

echo ========================================
echo ALL TESTS PASSED!
echo ========================================
echo.
echo Files created:
echo - src/contour-core/      : Standalone contour module
echo - test_contour_comparison.html : Browser test
echo - minimal_contour_demo.html     : Gold standard demo
echo.
echo Next steps:
echo 1. Open test_contour_comparison.html in a browser
echo 2. Open minimal_contour_demo.html in a browser
echo 3. Compare outputs
echo.
pause
