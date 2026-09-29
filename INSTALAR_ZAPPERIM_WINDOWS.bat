@echo off
setlocal EnableDelayedExpansion
cd /d "%~dp0"
title ZAPerim - instalar Cloudflare Pages (projeto separado)

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js nao esta instalado. Instale a versao LTS em https://nodejs.org/
  pause
  exit /b 1
)

echo Este instalador publica SOMENTE o projeto Cloudflare zapperim-app.
echo O site atual zapperim.pages.dev nao sera alterado.
echo Antes, instale os dois arquivos GAS da pasta dist no mesmo projeto Apps Script
echo e copie a URL do Web App terminada em /exec.
echo.
call node tools\build-installer.mjs
if errorlevel 1 goto :falha

call npx --yes wrangler login
if errorlevel 1 (
  echo Nao foi possivel autorizar a conta Cloudflare.
  goto :falha
)

set "PROJECT_LIST=%TEMP%\zapperim-pages-%RANDOM%.json"
call npx --yes wrangler pages project list --json > "%PROJECT_LIST%"
if errorlevel 1 (
  del "%PROJECT_LIST%" >nul 2>nul
  echo Nao foi possivel consultar os projetos da sua conta Cloudflare.
  goto :falha
)
node tools\pages-project-check.mjs "%PROJECT_LIST%" zapperim-app
set "PROJECT_STATUS=%ERRORLEVEL%"
del "%PROJECT_LIST%" >nul 2>nul
if "%PROJECT_STATUS%"=="2" goto :falha
if "%PROJECT_STATUS%"=="1" (
  call npx --yes wrangler pages project create zapperim-app --production-branch main
  if errorlevel 1 goto :falha
) else (
  echo Projeto zapperim-app ja existe. Publicando nova versao nele.
)

echo.
if exist "GAS_WEB_APP_URL.txt" (
  echo Configurando a URL do GAS a partir de GAS_WEB_APP_URL.txt.
  set "SECRET_FILE=%TEMP%\zapperim-secret-%RANDOM%.json"
  call node tools\build-pages-secret.mjs "GAS_WEB_APP_URL.txt" "!SECRET_FILE!"
  if errorlevel 1 goto :falha
  call npx --yes wrangler pages secret bulk "!SECRET_FILE!" --project-name zapperim-app
  set "SECRET_STATUS=!ERRORLEVEL!"
  del "!SECRET_FILE!" >nul 2>nul
  if not "!SECRET_STATUS!"=="0" goto :falha
) else (
  echo Cole a URL /exec do seu GAS quando o Wrangler pedir o valor.
  echo Nao digite tokens, senhas nem o ID da planilha aqui.
  call npx --yes wrangler pages secret put GAS_WEB_APP_URL --project-name zapperim-app
  if errorlevel 1 goto :falha
)

call npx --yes wrangler pages deploy dist\cloudflare --project-name zapperim-app --branch main
if errorlevel 1 goto :falha

echo.
echo Publicacao de teste concluida. Confira:
echo A URL exibida pelo Wrangler acima, acrescentando /api/health
echo Resultado esperado: {"api":2,"connected":true,"status":"ready"}
echo Depois abra a mesma URL sem /api/health
pause
exit /b 0

:falha
echo.
echo Instalacao interrompida. Copie a mensagem de erro acima para diagnostico.
pause
exit /b 1
