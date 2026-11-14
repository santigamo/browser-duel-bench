# Politica de endpoints y rubrica de flujo

Una sola regla para todas las tareas de blind/tasks.ts y blind2/tasks.ts, para todas las herramientas. No cambia lo que pide ninguna tarea.

## Regla
- Permitido: paginas del sitio y enlaces profundos (deep links) a paginas del propio sitio, con su query string, que el navegador carga y de las que se lee el resultado.
- Prohibido, salvo que el enunciado de la tarea lo permita: endpoints de datos JSON/API (api.*, /api/, fdsnws, .json, feeds GeoJSON, servicios SDMX...). Ninguna tarea actual lo permite (`allowApi` vacio en todas).
- Los documentos publicados que enlaza la propia pagina (por ejemplo los XML/CSV de tipos de cambio del BCE, el atom de releases de GitHub) cuentan como paginas del sitio. Es una decision de criterio, anotada en las rubricas de b6 y c11.

## Como se aplica
1. `forbidden` por tarea: los endpoints de datos propios de cada sitio (incluidos los que el enunciado no nombraba: b10, b13, b16, b20 y todas las c). Se prueba contra las URL escritas, las navegaciones registradas y ahora tambien las peticiones literales hechas desde codigo de pagina (fetch/XHR).
2. Regla generica (src/workflow.ts, detector de src/api-detect.ts): navegacion o peticion desde codigo de pagina a una URL con forma de API, salvo `allowApi`. Se registra como violacion `endpoint-policy`, que quita el exito conforme. `--endpoint-policy off` en run.ts restaura la regla anterior (solo navegaciones).
3. Antes: c10 no tenia ninguna regla y b11 (mismo sitio, mismos filtros) prohibia federalregister.gov/api; en blind2 las ejecuciones podian leer la API del propio comprobador y contar como conformes.

## Rubrica de flujo (`workflow`)
Solo las tareas cuyo enunciado dice usar la interfaz del sitio la llevan. Dice si un deep link la satisface y se puntua APARTE de la correccion de la respuesta (campos workflow_ok, workflow_missing, workflow_deeplink; no cambian success ni clean).
- `deepLink: "satisfies"` (la mayoria): una URL del propio sitio que muestra el resultado cumple; basta no haber usado un endpoint de datos. Caso b5 (hn.algolia.com): el estado de la busqueda vive en la URL, asi que el deep link ES la interfaz; no hace falta hacer clic. Caso b11/c10: la URL documents/search con filtros es la busqueda del sitio en ambas.
- `deepLink: "does-not-satisfy"` (b8, b14): el enunciado pide operar un formulario sin estado en la URL; hace falta evidencia de interaccion (rellenar/hacer clic) ademas de no usar el servicio web.
- workflow_ok = sin violacion de endpoint Y, si el deep link no satisface, evidencia de interaccion.

## Tareas donde hubo que juzgar
b4 (buscar y luego abrir: ir directo a la ficha se acepta), b5 (clic vs deep link: deep link), b8 (formulario sin URL: exige interaccion), b6/c11 (feeds publicados: permitidos), c4 (los feeds GeoJSON del propio sitio: prohibidos), c15 (deep link con filtros: permitido), c16/c18/c20 (sin API publica que nombrar: solo la regla generica).
