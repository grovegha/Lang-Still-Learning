@echo off
setlocal
cd /d "%~dp0"
title Lang - Still Learning
echo.
echo Lang - Still Learning
echo Folder aplikasi: %cd%
echo.
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js belum terpasang. Pasang Node.js 24 LTS dari https://nodejs.org/
  echo Setelah instalasi selesai, tutup jendela ini dan jalankan ulang file ini.
  pause
  exit /b 1
)
node -e "const [a,b]=process.versions.node.split('.').map(Number);process.exit(a>22||(a===22&&b>=13)?0:1)"
if errorlevel 1 (
  echo Versi Node.js terlalu lama. Pasang Node.js 24 LTS.
  pause
  exit /b 1
)
where npm >nul 2>nul
if errorlevel 1 (
  echo npm tidak ditemukan. Pasang ulang Node.js dengan opsi npm.
  pause
  exit /b 1
)
if not exist .env copy /y .env.example .env >nul
if not exist node_modules (
  echo Memasang kebutuhan aplikasi. Koneksi internet diperlukan.
  call npm ci --no-audit --no-fund
  if errorlevel 1 goto gagal
)
echo Menyiapkan tampilan aplikasi...
call npm run build
if errorlevel 1 goto gagal
echo.
echo Setelah muncul alamat server, buka alamat tersebut di browser.
echo Alamat bawaan: http://127.0.0.1:3000
echo Biarkan jendela ini terbuka selama menggunakan aplikasi.
echo Tekan Ctrl+C untuk menghentikan server.
echo.
call npm start
if errorlevel 1 goto gagal
exit /b 0
:gagal
echo.
echo Aplikasi belum berhasil dijalankan. Simpan pesan error di atas untuk diperiksa.
pause
exit /b 1
