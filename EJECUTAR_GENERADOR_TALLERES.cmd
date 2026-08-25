@echo off
cd /d F:\TallerMapPublicacion
echo.
echo TallerMap - generar fichas HTML desde los talleres activos de Supabase
echo Destino: F:\TallerMapPublicacion\talleres\
echo.
node generar-talleres-estaticos.mjs
echo.
echo Proceso terminado. Revisa el resumen:
echo F:\TallerMapPublicacion\tallermap_talleres_estaticos_resultado.csv
echo.
pause
