# Resultados: optimización para Safari en iPhone

Fecha: 2026-11-01

## 1. Identificación

- Rama: `codex/optimizacion-safari` ([ver rama en GitHub](https://github.com/LucasPioli36/gasto-tracker/tree/codex/optimizacion-safari)).
- Base actualizada: `origin/main` — `0e0c93a649bd240b5f21611ccc3f8b9e9fcf4bdf` (incluye Inversiones CSPX).
- SHA final del cambio de código validado: `4719724e9e2c307e9c74a47d0a0b9848b4f34bbf`.
- PR: no creado; la CLI de GitHub indica que las credenciales locales son inválidas.
- Preview y SHA de producción: no verificados. Vercel CLI devolvió `fetch failed` al consultar el proyecto y la herramienta web no pudo abrir el dominio. Esto no confirma que el sitio esté caído.
- Producción: sin cambios ni publicación.

## 2. Estado de cada prioridad

### P1 — Navegación con respuesta inmediata: parcial

- Se agruparon las rutas autenticadas bajo `app/(authenticated)/`, que conserva las URLs públicas existentes. La barra inferior vive en el layout compartido y tiene una frontera `Suspense` propia para que una lectura de perfil no bloquee su fallback.
- Se agregó un esqueleto compartido de carga, una indicación activa/pendiente en la navegación y una pantalla de error con reintento. La barra permanece en el layout compartido durante errores de página.
- Los enlaces de navegación mantienen el prefetch predeterminado de Next 16; los enlaces por fila a Editar usan `prefetch={false}` para no precargar cada movimiento dinámico.
- Falta medir la respuesta visual y comprobar Atrás/Adelante en Safari real. El esqueleto es compartido, no específico de cada pantalla.

Archivos principales: `app/(authenticated)/layout.tsx`, `loading.tsx`, `error.tsx`, `components/BottomNav.tsx`, `components/BottomNavClient.tsx`, `components/ExpenseItem.tsx`.

### P1 — Latencia de lectura: parcial

- Se paralelizaron lecturas independientes en Inicio, Yo, Métricas y Configuración después de obtener la sesión.
- `getCoupleMetadata()` separa presupuesto/nombres de los movimientos del mes. Configuración y Editar ya no piden esos movimientos. Editar y Agregar dejaron de esperar sugerencias de referencias; Agregar muestra primero el formulario.
- Se limitaron columnas de movimientos individuales y de pareja a los campos usados por las pantallas. Las consultas de historial conservan todos los movimientos del período para sus totales.
- Los errores de lectura de las vistas principales ahora llegan a un límite de error con reintento en lugar de convertirse silenciosamente en listas vacías.
- No se alteró `React.cache()`: sigue deduplicando dentro de una petición. No se agregaron cachés persistentes, índices de rendimiento ni cambios de infraestructura sin mediciones que los justifiquen.
- La comparación de duración, p95 y consultas reales queda pendiente por falta de sesión autenticada de prueba y acceso de medición a producción.

Archivos principales: `lib/dal.ts`, `app/(authenticated)/home/page.tsx`, `individual/page.tsx`, `metricas/page.tsx`, `config/page.tsx`, `editar/[id]/page.tsx`.

### P2 — Estados y recuperación de operaciones: parcial

- Configuración, gastos e inversiones conservan estados pendientes y errores visibles. Las escrituras de configuración, edición y eliminación verifican errores y filas afectadas; el borrado conserva confirmación y devuelve errores de sesión/permisos al flujo de navegación.
- Las altas y ediciones mantienen los valores del formulario al fallar. La acción de alta usa una clave estable guardada con el borrador y una restricción única para conciliar un reintento después de perder la respuesta. El lote de cuotas sigue siendo un único `INSERT`.
- Se agregó `migrations/2026-11-01-expense-submission-idempotency.sql` y se actualizó `schema.sql`/`lib/db.ts`. **La migración no se aplicó** porque no hay acceso confirmado a una base de prueba. Debe aplicarse a la base de preview antes de probar altas; hasta entonces, el guardado de gastos en un despliegue con el esquema anterior devolverá un error.
- No se ejecutaron escenarios reales de desconexión, doble toque, permisos, sesión vencida, cuotas ni duplicados. La protección de reintentos se revisó en código, pero necesita la migración y la prueba de integración.

Archivos principales: `actions/expenses.ts`, `actions/config.ts`, `actions/investments.ts` (sin cambio funcional), `components/ExpenseForm.tsx`, `components/ExpenseItem.tsx`, formularios de Configuración, migración y esquema.

### P2 — Alta de gastos más corta: parcial

- Monto y referencia tienen prioridad visual; las categorías frecuentes están disponibles primero y el resto se despliega. Se mantiene el contexto individual/pareja de la URL y se puede cambiar de forma consciente.
- El formulario conserva el borrador en `sessionStorage`, lo descarta al guardar o elegir “Descartar”, y elimina borradores de otra cuenta al cambiar de usuario en ese navegador. La fecha inicial usa `America/Montevideo`.
- Guardar permanece en el flujo del formulario con posición `sticky` por encima de la barra inferior; se usan teclado decimal, labels asociados, errores próximos a sus campos y `aria-live`.
- Las sugerencias recientes se omitieron para no bloquear la apertura. No se midió si el recorrido requiere menos desplazamientos ni se verificó el teclado abierto en iPhone.

Archivos principales: `components/ExpenseForm.tsx`, `app/(authenticated)/agregar/page.tsx`, `actions/expenses.ts`.

### P2 — Controles y lectura móvil: parcial

- Editar y Eliminar tienen áreas de 44 × 44 CSS px y separación. La navegación aumenta el tamaño de texto, marca la pestaña actual y anuncia la pendiente; Inversiones conserva su acceso únicamente para el propietario.
- Se quitó la restricción de zoom del viewport y se usa `100dvh` con la safe area en la barra inferior.
- No se verificaron anchos 375/390 CSS px, orientación, zoom, barra de Safari, foco, ni las dos variantes del permiso de Inversiones en un dispositivo. No se declara validado Safari en iPhone.

Archivos principales: `components/BottomNavClient.tsx`, `components/ExpenseItem.tsx`, `app/layout.tsx`, `app/globals.css`.

## 3. Resultados medidos

No hubo sesión autenticada de prueba, dispositivo iPhone ni acceso a la telemetría del despliegue. No se reemplazan mediciones ausentes por estimaciones. Se conservan las mismas condiciones y muestras como **no medido** en ambos lados.

| Recorrido | Entorno/dispositivo | Visita | Muestras | Respuesta visual antes/después | Contenido útil o confirmación antes/después | Mediana y p95 antes/después |
|---|---|---|---:|---|---|---|
| Yo → Pareja → Métricas → Yo | Producción, Safari iPhone: no disponible | Primera y posteriores | no medido | no medido / no medido | no medido / no medido | no medido / no medido |
| Pareja → Agregar → guardar gasto → volver al listado | Cuenta de prueba pareja: no disponible | Primera y posteriores | no medido | no medido / no medido | no medido / no medido | no medido / no medido |
| Editar y eliminar movimiento de prueba | Cuenta de prueba: no disponible | Primera y posteriores | no medido | no medido / no medido | no medido / no medido | no medido / no medido |
| Configuración | Cuenta de prueba: no disponible | Primera y posteriores | no medido | no medido / no medido | no medido / no medido | no medido / no medido |
| Inversiones con propietario autorizado | Sesión de propietario: no disponible | Primera y posteriores | no medido | no medido / no medido | no medido / no medido | no medido / no medido |
| Anchos 375 y 390 CSS px, zoom, teclado y safe area | Safari/WebKit: no disponible | no aplica | no medido | no medido / no medido | no medido / no medido | no medido / no medido |

## 4. Acceso a datos

Los conteos siguientes describen llamadas del código, no solicitudes observadas en red.

| Pantalla | Antes | Después |
|---|---|---|
| Yo | Perfil y luego movimientos (2 consultas secuenciales) | Perfil y movimientos iniciados en paralelo (2 consultas) usando `session.userId` |
| Inicio | Perfil → movimientos individuales → datos de pareja | Perfil, movimientos individuales y datos de pareja iniciados en paralelo después de la sesión |
| Configuración | Perfil → pareja, movimientos del mes y miembros (4 consultas DB en total) | Perfil y metadatos de pareja en paralelo; 3 consultas DB en total y ninguna de movimientos |
| Editar | Movimiento → sugerencias + datos de pareja (incluían mes y miembros); hasta 5 consultas DB | Movimiento y metadatos de pareja en paralelo; 3 consultas DB, sin sugerencias ni movimientos del mes |
| Agregar | Sesión → sugerencias recientes → formulario | Sesión → formulario; no consulta sugerencias al abrir |
| Métricas | Perfil, movimientos, pareja, historial individual e historial de pareja en etapas | Perfil, movimientos individuales, historial individual y datos de pareja en paralelo; historial de pareja empieza al llegar el presupuesto. Mismas 7 consultas DB con pareja, menor dependencia en serie |

`getCoupleMetadata()` obtiene las columnas de presupuesto/IDs y los nombres de miembros; `getCoupleData()` inicia esa lectura y los movimientos actuales en paralelo. Las lecturas dependen del usuario o `coupleId` de sesión y no se añadió caché compartida entre cuentas. No se obtuvo plan de ejecución, duración SQL, región Supabase ni evidencia para índices de rendimiento. La única migración es la clave única de idempotencia descrita arriba.

## 5. Corrección

- Se conservaron las funciones existentes de totales y cálculos; la modificación no cambió `lib/totals.ts`, `lib/installments.ts`, autorización de rutas ni el control de propietario CSPX.
- El acceso a pareja sigue usando el `coupleId` de la sesión. Inversiones continúa detrás de `requireInvestmentOwner()` y el enlace se muestra según el usuario propietario.
- Altas de cuotas siguen siendo atómicas en un `INSERT`; reintentos de la misma clave no vuelven a insertar movimientos después de aplicar la migración.
- Errores de comprobación de duplicados ahora impiden guardar en vez de continuar sin la consulta. Errores de escritura no producen estado exitoso.
- **Saldos coincidentes, aislamiento entre dos cuentas, permisos, cuotas, duplicados y rechazos de escritura: no verificados con datos de prueba**, por falta de base y sesión de prueba accesibles.

## 6. Validación

- `npm run lint`: pasó con 0 errores; permanecen 2 avisos en `app/demo/page.tsx` (`Home` y `NAV` sin uso), ajenos a estos cambios.
- `npm run build`: pasó con Next.js 16.2.10 / React 19.2.4. Requirió acceso de red para que `next/font/google` obtuviera Geist, ya configurada por el proyecto.
- `git diff --check`: pasó.
- Compilación mostró las URLs originales (`/agregar`, `/config`, `/editar/[id]`, `/home`, `/individual`, `/inversiones`, `/metricas`, `/pareja`).
- No hay suite de integración configurada y no se ejecutaron mutaciones contra datos reales. No se usó navegador móvil emulado ni WebKit para validar diseño; no se usó Safari en iPhone real. No hay capturas ni video de flujos autenticados.

## 7. Pendientes

1. Aplicar la migración de idempotencia a una base de **preview/prueba** y verificar que la versión de preview use ese esquema.
2. Conseguir cuentas de prueba individual, pareja y propietaria de CSPX. Ejecutar sesión iniciada/vencida, URL directa, acceso denegado a Inversiones, gasto/ingreso, cuotas, Otros, duplicado, fallo de escritura, desconexión, doble toque, edición y eliminación.
3. Medir en build de producción las navegaciones principales con al menos 20 muestras bajo las mismas condiciones antes/después; registrar primera respuesta, contenido útil, p50, p95 y solicitudes. Medir mutaciones por separado con las muestras reales obtenidas.
4. Probar 375/390 CSS px, zoom, teclado abierto/cerrado, safe area y Atrás/Adelante; cerrar con Safari en iPhone real. Registrar modelo, iOS, red y caché.
5. Verificar región y consultas de Supabase/Vercel cuando el acceso esté disponible. No decidir índices por los conteos del código.

## 8. Revisión y publicación

- La rama remota está lista para revisar; los cambios están en el commit `4719724`. Para reproducir localmente: aplicar el esquema de prueba, configurar variables locales y ejecutar `npm run lint` y `npm run build`.
- No hay PR ni preview verificados: `gh auth status` informa credenciales inválidas, y Vercel CLI no pudo leer el proyecto. No se creó un preview manual.
- Producción queda pendiente de revisión. Antes de publicar, aplicar y validar la migración, ejecutar los flujos autenticados y verificar preview. Si se publica y hace falta revertir el código, revertir el commit `4719724`; revertir el efecto de la migración requiere una decisión de datos y no se automatizó.
