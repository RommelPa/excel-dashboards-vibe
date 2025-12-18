# Excel Dashboards Vibe

Panel React para validar y visualizar dashboards de Excel con soporte de sincronización desde SharePoint/Graph.

## Requisitos
- Node.js 18+
- Cuenta de Microsoft con permisos de lectura en los archivos de SharePoint configurados.

## Configuración
1. Copia `.env.example` a `.env` y completa los valores:
   - `VITE_MSAL_CLIENT_ID` y `VITE_MSAL_AUTHORITY` para MSAL.
   - `VITE_SHAREPOINT_FACTURACION_URL` y `VITE_SHAREPOINT_BALANCE_URL` sin parámetros de token (`?e=...`).
   - `VITE_BLANK_THRESHOLD` y `VITE_MAX_FILE_SIZE_MB` para ajustar la extracción y validación.
2. Instala dependencias: `npm install`.
3. Ejecuta en desarrollo: `npm run dev`.

## Scripts
- `npm run dev`: inicia el servidor de desarrollo.
- `npm run build`: genera el bundle de producción.
- `npm run preview`: vista previa del build.
- `npm run lint`: linting con ESLint + React/TypeScript.
- `npm run test`: pruebas con Vitest/Testing Library.

## Notas de seguridad
- Las credenciales y URLs sensibles se leen desde variables de entorno y no se incrustan en el bundle.
- La caché de autenticación usa `sessionStorage` para limitar la persistencia de datos PII.
