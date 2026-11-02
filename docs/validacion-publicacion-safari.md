# Validación previa a publicación de Safari

Fecha de inicio: 2026-11-02. Base revisada: `0226e15`.

## Estado comprobado

- Proyecto Vercel confirmado: `lucasteam3/gasto-tracker`.
- Sesión de Supabase disponible para el proyecto correcto. PostgreSQL productivo: 17.6.
- El plan gratuito no incluye copias automáticas. Se realizó una exportación lógica manual, consistente y con checksum de origen, de las nueve tablas públicas y sus definiciones.
- Inventario de producción obtenido con SELECT: nueve tablas públicas, incluidas las tablas históricas y `user_income` que no figuran en el esquema actual del repositorio.
- PostgreSQL portable oficial 17.11 funcionando en `127.0.0.1:54740`, con bases dedicadas `gasto_tracker_test_*` y datos ficticios. Docker no quedó disponible y no se utilizó para estas pruebas.
- PostgREST oficial 16.5 funcionando junto a la app compilada; se verificó su SHA-256 publicado.
- Se agregaron pruebas de integración y la dependencia de desarrollo `pg`. Los scripts de validación rechazan destinos PostgreSQL fuera de localhost y bases que no tengan el prefijo de prueba.

## Resultado de PostgreSQL real

Comando: `node scripts/validation/local-postgres.mjs test`.

**11 pruebas correctas, 0 fallos.**

1. La migración conserva importes y datos heredados y crea el índice único estable.
2. Repetirla después de cambiar el pagador conserva usuario de envío, identidad y huella.
3. Una clave histórica desconocida aborta sin modificar datos heredados.
4. Las identidades históricas duplicadas abortan sin eliminar movimientos.
5. Dos envíos concurrentes idénticos guardan un solo movimiento.
6. Dos lotes concurrentes idénticos guardan un único lote de tres cuotas.
7. Montos concurrentes distintos no generan un segundo lote.
8. Ámbitos concurrentes distintos no generan un segundo lote.
9. Cantidades de cuotas concurrentes distintas no generan un segundo lote.
10. Dos usuarios pueden utilizar el mismo UUID sin cruzar sus envíos.
11. Un conflicto revierte todas las filas del lote perdedor.

Son pruebas contra PostgreSQL real, mediante conexiones independientes y el coordinador real de envíos. No sustituyen todavía los recorridos completos del navegador contra la app.

## Archivos locales privados de validación

Los binarios, el clúster local, los logs y las credenciales generadas exclusivamente para las cuentas ficticias están en `.vercel/validation-20261102/`, ignorado por Git. El proyecto no carga credenciales productivas al iniciar la app de prueba: los scripts fijan explícitamente la API, la sesión y los valores de inversión ficticios.

La revisión automática rechazó una descarga adicional de variables productivas por duplicar secretos en otro archivo local. No se realizó esa descarga ni se reintentó; el acceso al panel de Supabase permite preparar el respaldo por otra vía.

## Respaldo verificado

Se exportaron nueve tablas públicas con 678 registros, incluidas las tablas históricas y `user_income`. El contenido JSON se exportó como texto para conservar la precisión decimal y se comprobó el checksum calculado por PostgreSQL en origen.

La copia principal está en `.vercel/validation-20261102/backups/public-before-safari-exact.csv.dpapi`, cifrada con Windows DPAPI para el usuario actual de este equipo. Requiere ese perfil de Windows para descifrarse. Este es un respaldo lógico de las tablas públicas y su estructura; no es un respaldo integral de la plataforma Supabase, sus roles/permisos, Auth ni Storage.

Se restauraron las nueve tablas, sus restricciones, índices, función y banderas RLS en una base local separada. Se verificó igualdad de los registros mediante PostgreSQL y se aplicó la migración dos veces sobre esa copia, conservando todos los campos originales. La base de restauración se eliminó al terminar. El informe privado de verificación está en `.vercel/validation-20261102/backups/restore-verification.json`.

La compilación de producción con configuración ficticia pasó. El inicio de sesión desde el navegador local pasó; Inicio muestra los saldos esperados de las cuentas ficticias. Al navegar a Agregar se observó la pantalla de carga manteniendo la barra inferior disponible.

## Recorridos autenticados comprobados

- Inicio de sesión por formulario, también a través del enlace HTTPS temporal.
- Navegación manteniendo la barra inferior durante la carga.
- Alta individual por 123,45, recuperación del monto, referencia y categoría del borrador al volver desde otra pantalla, edición a 200,50 y eliminación con confirmación. El saldo volvió al valor esperado.
- Alta de pareja por 300 en tres cuotas. PostgreSQL confirmó tres filas de 100 en tres meses distintos, con identidad de envío y pagador correctos. El mes actual computó 100, sin sumar todo el lote.
- Ingreso individual de 50, con una única fila y aumento de 50 en el disponible.
- Configuración: rechazo de meta igual al sueldo, corrección del campo y confirmación `¡Guardado!`.
- Sugerencias autenticadas: incluyen referencias propias y compartidas, excluyen las privadas de la otra persona. Sesiones ausentes, inválidas y vencidas reciben 401.
- Las siete pantallas protegidas redirigen a Login sin sesión y cargan con la cuenta autorizada. Una segunda cuenta y una cuenta sin pareja no pueden editar el movimiento individual de A ni acceder a Inversiones. La cuenta sin pareja carga sin mostrar el acceso de propietario a Inversiones.

Las comprobaciones HTTP usan sesiones sintéticas firmadas exclusivamente con el secreto local de prueba; no reemplazan el inicio de sesión de interfaz, que se comprobó por separado. En rutas con streaming, Next puede enviar una cabecera 200 antes de resolver `notFound()`; se comprobó la respuesta de página no encontrada y la ausencia del contenido privado, además del estado HTTP.

No se probaron todos los escenarios de pérdida de conexión ni todos los formularios de inversión por interfaz. La concurrencia se verificó en PostgreSQL con el coordinador real, no mediante dos iPhone enviando simultáneamente.

## Interfaz móvil y medición local

Se observó el formulario con un viewport solicitado de 390 × 844 y ancho de documento de 375, sin desbordamiento horizontal. Los controles principales y la navegación tienen al menos 44 px de alto. Se detectó y corrigió una excepción: los selectores de cuotas tenían 40 px; ahora todos tienen 44 px y el campo `Otra` usa texto de 16 px. La captura [Agregar móvil](evidencias-validacion-safari/agregar-mobile.jpg) corresponde a la compilación corregida, con datos ficticios.

Se hicieron diez lecturas HTTP calientes por ruta contra el build de producción local, incluyendo la descarga completa de HTML:

| Ruta | Mediana | p90 |
|---|---:|---:|
| Yo | 29 ms | 31 ms |
| Pareja | 32 ms | 37 ms |
| Agregar | 26 ms | 32 ms |
| Métricas | 47 ms | 49 ms |
| Configuración | 24 ms | 26 ms |

Estas cifras son de loopback con datos ficticios y PostgreSQL local. **No miden Safari, red móvil, producción ni una mejora antes/después.** Tampoco representan el tiempo desde un toque hasta contenido utilizable. No se declara alcanzado un objetivo porcentual de rendimiento.

## Safari real y publicación

Se habilitó un enlace HTTPS temporal mediante Cloudflare Quick Tunnel hacia el puerto 3005 de la app ficticia. No expone PostgreSQL, PostgREST, los archivos del respaldo ni las credenciales productivas. Se verificaron Login, navegación y el formulario a través del enlace. Es una compilación local con transporte temporal; no un preview hospedado en Vercel ni una referencia válida de rendimiento productivo.

Se solicitó al usuario probar navegación, teclado y guardado desde Safari del iPhone. Respondió **“Lo pruebo más tarde”**. Quedan pendientes su resultado, modelo/iOS, zoom, teclado, safe area y Atrás/Adelante. El enlace deja de funcionar al detener el túnel o apagar este equipo.

Se registró el despliegue productivo previo: `dpl_HLxEAKKjWUxEqVKQFvJh9bWXhSsE`, URL `gasto-tracker-7cfh7xoyj-lucasteam3.vercel.app`, estado READY. El registro privado está en `.vercel/validation-20261102/production-before-release.json`.

La siguiente secuencia queda preparada:

1. Recibir el resultado de Safari y corregir cualquier bloqueo observado.
2. Consultar si hubo cambios en los datos desde el respaldo; obtener y verificar una copia reciente antes de migrar si corresponde.
3. Aplicar la migración exacta a producción dentro de una transacción y verificar índices, filas y preservación de datos.
4. Publicar el código, comprobar el despliegue y recorrer las pantallas principales. Registrar la versión nueva.
5. Si falla el despliegue, volver al despliegue previo. La migración es aditiva y compatible con el código anterior; no se deben borrar columnas ni restaurar automáticamente datos antiguos, porque se podrían perder operaciones posteriores al respaldo.

## Reproducción en este equipo

Herramientas oficiales instaladas únicamente en el directorio ignorado: PostgreSQL 17.11 portable y PostgREST 16.5. No se instaló un servicio global. El clúster escucha solo en loopback. Las credenciales generadas están en los archivos locales ignorados; no se necesitan las variables productivas para estas pruebas.

```powershell
node scripts/validation/local-postgres.mjs test
node scripts/validation/public-backup.mjs verify .vercel/validation-20261102/backups/public-before-safari-exact.csv.dpapi
node scripts/validation/local-app.mjs build
node scripts/validation/local-app.mjs start
node scripts/validation/local-smoke.mjs
```

El último comando comprueba los registros ficticios creados por los recorridos descritos; requiere conservar esos fixtures. Las pruebas PostgreSQL crean y eliminan sus propios esquemas. `public-backup.mjs` requiere el perfil Windows original, crea una base local de restauración y la elimina al terminar. Nunca aplica la migración al origen del respaldo.

Tras la corrección táctil: `npm test` 9/9; `npm run lint` 0 errores, los dos avisos preexistentes de `app/demo/page.tsx`; build de producción local correcto con TypeScript y configuración ficticia.

La migración productiva y la publicación todavía no se realizaron.
