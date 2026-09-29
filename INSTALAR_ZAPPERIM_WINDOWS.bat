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

echo Este instalador publica SOMENTE um projeto Cloudflare novo e separado.
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

for /f "usebackq delims=" %%N in (`node tools\pages-project-name.mjs PAGES_PROJECT_NAME.txt`) do set "PROJECT_NAME=%%N"
if not defined PROJECT_NAME (
  echo Nao foi possivel definir o nome do projeto.
  goto :falha
)
echo Projeto desta instalacao: %PROJECT_NAME%

set "PROJECT_LIST=%TEMP%\zapperim-pages-%RANDOM%.json"
call npx --yes wrangler pages project list --json > "%PROJECT_LIST%"
if errorlevel 1 (
  del "%PROJECT_LIST%" >nul 2>nul
  echo Nao foi possivel consultar os projetos da sua conta Cloudflare.
  goto :falha
)
node tools\pages-project-check.mjs "%PROJECT_LIST%" "%PROJECT_NAME%"
set "PROJECT_STATUS=%ERRORLEVEL%"
del "%PROJECT_LIST%" >nul 2>nul
if "%PROJECT_STATUS%"=="2" goto :falha
if "%PROJECT_STATUS%"=="1" (
  call npx --yes wrangler pages project create "%PROJECT_NAME%" --production-branch main
  if errorlevel 1 goto :falha
) else (
  echo Projeto %PROJECT_NAME% ja existe nesta conta. Publicando nova versao nele.
)

echo.
if exist "GAS_WEB_APP_URL.txt" (
  echo Configurando a URL do GAS a partir de GAS_WEB_APP_URL.txt.
  set "SECRET_FILE=%TEMP%\zapperim-secret-%RANDOM%.json"
  call node tools\build-pages-secret.mjs "GAS_WEB_APP_URL.txt" "!SECRET_FILE!"
  if errorlevel 1 goto :falha
  call npx --yes wrangler pages secret bulk "!SECRET_FILE!" --project-name "%PROJECT_NAME%"
  set "SECRET_STATUS=!ERRORLEVEL!"
  del "!SECRET_FILE!" >nul 2>nul
  if not "!SECRET_STATUS!"=="0" goto :falha
) else (
  echo Cole a URL /exec do seu GAS quando o Wrangler pedir o valor.
  echo Nao digite tokens, senhas nem o ID da planilha aqui.
  call npx --yes wrangler pages secret put GAS_WEB_APP_URL --project-name "%PROJECT_NAME%"
  if errorlevel 1 goto :falha
)

call npx --yes wrangler pages deploy dist\cloudflare --project-name "%PROJECT_NAME%" --branch main
if errorlevel 1 goto :falha

echo.
echo Consultando o endereco real do projeto publicado...
set "PROJECT_LIST=%TEMP%\zapperim-pages-%RANDOM%.json"
call npx --yes wrangler pages project list --json > "%PROJECT_LIST%"
if errorlevel 1 (
  del "%PROJECT_LIST%" >nul 2>nul
  echo O deploy terminou, mas nao foi possivel consultar o dominio.
  echo Confira a URL exibida pelo Wrangler acima e o status no painel Cloudflare.
  goto :falha
)
node tools\pages-project-url.mjs "%PROJECT_LIST%" "%PROJECT_NAME%"
set "URL_STATUS=%ERRORLEVEL%"
del "%PROJECT_LIST%" >nul 2>nul
if not "%URL_STATUS%"=="0" goto :falha

echo.
echo Abra os enderecos acima. Se aparecer erro 523 logo apos o primeiro deploy,
echo confira o status da publicacao no painel Cloudflare e tente novamente depois
echo de o DNS do novo subdominio se propagar. Nao use um dominio presumido.
echo Resultado esperado: {"api":2,"connected":true,"status":"ready"}
pause
exit /b 0

:falha
echo.
echo Instalacao interrompida. Copie a mensagem de erro acima para diagnostico.
pause
exit /b 1
