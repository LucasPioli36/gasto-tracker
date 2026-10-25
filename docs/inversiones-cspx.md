# Inversiones CSPX

La pantalla usa la API oficial de Google Sheets para leer solo `Hoja 1!A1:B1` de la hoja CSPX. A1 aporta el precio; B1 aporta la hora de la última operación. La cartera y el historial permanecen en Supabase, separados por usuario.

## Antes de probar

1. En Google Sheets, configurá el acceso general de la hoja como **Cualquier persona con el enlace · Lector**. La integración de Drive conectada a esta sesión no puede cambiar ese permiso a público; hacelo desde la interfaz de Google Sheets.
2. En Google Cloud, habilitá Google Sheets API, creá una clave de API y limitá la clave a Google Sheets API. La clave permite leer únicamente datos públicos y se guarda en el servidor.
3. Copiá `GOOGLE_SHEETS_API_KEY`, `GOOGLE_SHEETS_SPREADSHEET_ID` y `CRON_SECRET` a `.env.local` y a las variables de entorno de Vercel. `CRON_SECRET` debe ser un valor aleatorio largo. Definí `INVESTMENTS_OWNER_USERNAME` con el nombre de usuario de tu cuenta de la app; la pantalla, los valores y las acciones quedan disponibles solo para esa cuenta. No compartas la clave de API ni el secreto de cron.
4. Ejecutá `migrations/2026-10-21-inversiones-cspx.sql` en el editor SQL de Supabase.
5. Iniciá la app y abrí `/inversiones`. El saldo inicial aparece precargado con US$9.988 invertidos y US$749 de ganancia (US$10.737 en total). Guardalo una vez que la pantalla reciba la primera cotización.

## Actualización

Vercel llama `/api/inversiones/cotizacion` a las 22:00 UTC de lunes a viernes. El endpoint requiere `Authorization: Bearer $CRON_SECRET`, lee A1:B1 sin pedir permisos de escritura y guarda un precio por fecha de mercado. Rechaza valores sin precio, con fecha futura o con más de cinco días. La hora se conserva como la muestra Google Sheets, sin asignarle una zona horaria.

Las unidades se calculan internamente: el saldo inicial total dividido por la primera cotización, y cada compra en USD dividida por la última cotización guardada. La pantalla no pide que se carguen cantidades de participaciones. El valor y la ganancia son estimaciones porque el precio diario no es el precio de ejecución exacto ni incluye comisiones.

Para comprobar la lectura manualmente desde un entorno que ya tenga las variables configuradas:

```powershell
$headers = @{ Authorization = "Bearer $env:CRON_SECRET" }
Invoke-RestMethod -Method Get -Uri "http://localhost:3000/api/inversiones/cotizacion" -Headers $headers
```

El PR queda pendiente hasta confirmar la actualización con la hoja cerrada y verificar el flujo completo de lectura, guardado, saldo, compra y ganancia.
