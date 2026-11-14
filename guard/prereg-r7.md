# Evaluacion a ciegas de r7: plan fijado antes de ver las tareas

Fijado el 2026-11-08 por el coordinador, con el diseno acordado en el debate Claude/Codex. No se cambia despues de ver las tareas.

## Congelado
- agent-browser: tag r7 (ec3d72156), binario release sha256 edef54968c0f24ce...
- Textos: stub, core SKILL.md e instrucciones MCP de r7. Harness: este commit, salvo el enganche minimo que carga las tareas ciegas.
- Sin cambios de producto, textos ni analisis entre el inicio de la evaluacion y el informe. Sin repeticiones selectivas.

## Diseno
- 20 tareas nuevas de un autor independiente, que no vio tareas previas, transcripciones, skills ni codigo de las herramientas. Ni el coordinador ni el equipo de desarrollo leen el contenido antes de terminar.
- Variantes: ab-cli:r7 frente a browse-mcp.
- Modelo principal: claude-sonnet-5-5, runner claude, N=3 (120 ejecuciones).
- Segundo modelo: gpt-6.1-sol, runner codex, N=1 (40 ejecuciones). Sin cost_usd: usa cost_weighted (proxy).
- Navegador caliente, orden aleatorio por bloque tarea x repeticion con semilla registrada.

## Umbrales (modelo principal, ab-cli:r7 / browse-mcp, geomedia de ratios de mediana por tarea, bootstrap jerarquico 95 %)
- Exito conforme: 60/60 y ningun exceso de fallos frente a browse.
- Tiempo (agente, navegador caliente): punto <= 0,90 y cota superior < 1.
- Coste real (cost_usd): punto <= 0,90 y cota superior < 1.
- Pasos: punto <= 1,05 y cota superior <= 1,10.

## Segundo modelo (direccional, sin significancia)
- Tiempo y coste proxy < 1, pasos <= 1,10, sin exceso de fallos conformes.

## Reglas de exclusion y lectura
- Una tarea solo se excluye con evidencia externa de infraestructura caida y para todas las variantes.
- Los quota_abort tienen estado propio y obligan a repetir el bloque aleatorizado completo.
- Se mantienen todos los intentos validos. Timeout: se cuenta como fallo y con el tiempo y coste consumidos.
- Se publican tablas por tarea y sensibilidad del tiempo a las tareas influyentes.
- Si falla un umbral se dice que fallo. Es una prueba operativa de benchmark, no una prueba formal de superioridad general, y no cubre sesiones iniciadas.

## Enmienda 1 (2026-11-08, a peticion de Santi, antes de ver resultados por herramienta)

Motivo: el objetivo es que la ejecucion completa sea mas rapida y barata en coste y contexto; resolver en un solo paso no es un fin en si mismo.

En el momento de esta enmienda ninguna ejecucion ciega tiene puntuacion valida y no se han mirado metricas por variante. Solo se vio un agregado conjunto de las dos herramientas (mediana de pasos y de tiempo).

- Los pasos dejan de ser umbral. Se siguen publicando como dato descriptivo.
- Se anade como umbral el contexto: pico de contexto por ejecucion, el maximo por turno de input + cache_read + cache_creation en los eventos assistant de la transcripcion. Punto <= 0,90 y cota superior < 1, con la misma geomedia y bootstrap jerarquico. Solo para el modelo principal.
- Secundarias: bytes de herramienta devueltos al modelo y tokens de entrada acumulados.
- Se mantienen sin cambios exito conforme, tiempo y coste real.

## Desviacion 1 (2026-11-08): error de puntuacion

run.ts:222 quita el prefijo ANSWER: y blind/lib.ts:answerLine lo exigia, asi que toda ejecucion ciega quedo marcada como fallo en ambas variantes. No afecta al comportamiento de los agentes. Correccion: aceptar la respuesta ya sin prefijo y repuntuar con las respuestas guardadas, igual para ambas variantes. La verdad se recalcula en vivo al repuntuar porque el valor de prepare no se guardo.
