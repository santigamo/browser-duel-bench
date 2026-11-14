# Evaluacion ciega de r10.1: preregistro (BORRADOR para revision del coordinador, NO final)

> Nota posterior (2026-11-14, tras la ejecucion): el titulo y las frases de borrador de mas abajo se dejan tal cual por honestidad con la historia; el texto quedo fijado en el commit 1f93374 (13:49) y no se toco salvo la Enmienda 1 y las notas POST HOC del final.

Fijado el 2026-11-14, antes de que existan las tareas g1-g40. No se cambia despues de ver las tareas ni los resultados. Cualquier desviacion se anade al final como "Desviacion N" con fecha y motivo, antes de la ejecucion afectada, y se publica.

## Que se compara
- Comparacion PRIMARIA: nuestro fork r10.1 contra agent-browser upstream 0.43.0 (v043), ambos por CLI. Es la comparacion que responde si el fork mejora a upstream.
- Comparacion SECUNDARIA: r10.1 contra browse-mcp (la misma que r9). Descriptiva: mismas puertas, sin condicionar la conclusion principal.
- Hipotesis: r10.1 cuesta menos y usa menos contexto que upstream 0.43.0 en tareas de sitios reales, sin perder exito conforme.

## Congelado
- Harness: repositorio bench, commit 7049e9a (incluye blind4, --report r10 y el arreglo de sesiones nuevas bajo el sandbox). Incluye regla de traspaso (guard/handoff-policy.md), politica de endpoints (guard/endpoint-policy.md), bloque de reglas v1 (src/rules.ts) y el informe `python3 src/final.py <manifiesto> --report r10`.
- Bloque de reglas v1, sha256 a14bcfa4169cc0acfe3f860eb60a68dddaebe3518eb43f5ad97c3fcf99537f9e, texto exacto e identico para todas las variantes, entre el enunciado y la linea de herramienta. Activado por defecto para blind4 (`--rules v1`).
- r10.1 (ab-cli:r10): repositorio agent-browser-r10, tag r10.1, commit de5ec986229d0e10531813f90295baf759f5e387. Binario release sha256 c0b4a3137fbe4b5ba5e40757d741109bcf6c8091148d55f8640f42b7b17e6c21 (compilado en el commit r10; r10.1 solo cambia el stub y CHANGES-FORK.md, que el binario lee en tiempo de ejecucion, no los incrusta). La ejecucion solo vale si el sha256 usado coincide.
- v043 (ab-cli:v043): worktree ab-v043 del repositorio agent-browser en el tag v0.43.0, commit 1cc19526, binario release sha256 e423bf88f9d09a9be4fd630a00cea444937192ac3cbe0659f3194ef4ca90b866, `--version` 0.43.0.
- browse: version 0.0.14, commit 8d247e67e40a529b6419f98e50b298ed548a1874.
- Modelo claude-sonnet-5-5. Shell del CLI restringida a solo navegador (restricted-env). Navegador caliente, timeout fijo de 420 s solo para ejecucion activa. Headless, sin sesiones iniciadas.
- Stubs (lo que lee el modelo; sha256 tambien en `meta.json`, `variant_provenance`):
  - r10.1: skills/agent-browser/SKILL.md de agent-browser-r10, 2743 B en disco (1772 B entregados sin frontmatter), sha256 dfe3965f69d8347ffef2e2f6c8130bc77584da7b8c740f7f85f5da2c05664e48. Es el stub autosuficiente de r9, sin la frase que repite las reglas del benchmark y con cada afirmacion comprobada contra el codigo de r10.
  - v043: skills/agent-browser/SKILL.md del tag v0.43.0 sin modificar, 3316 B en disco (2299 B entregados sin frontmatter), sha256 60b28db5b700320c51d2b9f69f101631b753156fccee99f57af7c3a37aeaf9f8.
  - Entrega, igual para las dos variantes (src/run.ts, variante ab-cli): el contenido del SKILL.md sin su frontmatter va como system prompt del agente, leido del checkout del que salio el binario (`<bin>/../../../..`). El agente puede ademas ejecutar `agent-browser skills get core`, que el binario sirve desde el skill-data de ese mismo checkout. Ninguna variante recibe nada mas.

## Diseno
- 40 tareas nuevas (ids g1-g40, archivo blind4/tasks.ts), de un autor independiente; coordinador y desarrollo no leen su contenido antes del informe. Todas exigen la interfaz del sitio: ninguna se resuelve con un endpoint de datos, `allowApi` vacio. Cada una trae `forbidden` y rubrica `workflow` segun guard/endpoint-policy.md. El sha256 del archivo queda en `task_file_sha256` de meta.json y en el `checker_sha` de cada fila (src/versions.ts cubre blind4/tasks.ts) y no cambia tras la primera ejecucion. se registra en una enmienda fechada antes de ejecutar, en cuanto exista el archivo de tareas
- Variantes: ab-cli:r10, ab-cli:v043 y browse-mcp. N=1: 40 x 3 x 1 = 120 ejecuciones.
- Orden aleatorio por bloques (un bloque = una tarea; el orden de las tres variantes se baraja dentro del bloque, src/measure.ts planRuns) con semilla fijada ahora: 20261114 (`--seed`), registrada en meta.json y en cada fila.
- Comando: `./with-lock.sh bun src/run.ts --variants ab-cli:r10,ab-cli:v043,browse-mcp --tasks blind4 --n 1 --seed <semilla> --rules v1 --label r10-blind4 --bins r10=<bin r10.1>,v043=<bin v0.43.0>`.
- Traspaso a humano: tal como esta implementado (guard/handoff-policy.md): la primera peticion explicita termina la ejecucion, status=handoff, fallo, tiempo y coste cobrados hasta ese evento. Se publica la tasa por herramienta.
- Politica de endpoints (guard/endpoint-policy.md) activa para blind4, igual para todas las variantes.
- Conducta que quita el exito conforme, igual para todas: violacion de la politica de endpoints, `agent-browser read` o fetch fuera de la pagina, programas externos (shell restringida), respuesta final con cero llamadas a la herramienta de navegador.

## Puertas de la comparacion PRIMARIA (r10.1 / v043; media geometrica de las medianas por tarea; bootstrap jerarquico 95 %, tareas y luego ejecuciones, 2000 remuestreos, semilla 7)
Con N=1 la mediana por tarea es la unica ejecucion; el remuestreo de ejecuciones dentro de la tarea no anade variacion y el intervalo refleja solo la variacion entre tareas. Se declara asi.
1. Coste (cost_usd): punto <= 0,85 y cota superior del IC < 1.
2. Pico de contexto: punto <= 0,90 y cota superior < 1.
3. Exito conforme (respuesta correcta, evidencia y ninguna violacion): diferencia r10.1 menos v043 en puntos con su IC. Solo se afirma "al menos igual" si la cota inferior es >= -5 puntos.
4. Tiempo (wall cobrado): descriptivo. Solo se afirma "no mas lento" si la cota superior del IC de la razon es < 1,10.
Pasar las puertas 1 y 2 es la condicion de exito de la hipotesis de eficiencia; las afirmaciones de las puertas 3 y 4 son independientes y solo se hacen si se cumplen. Un fallo de puerta se informa como fallo. La comparacion secundaria (r10.1 / browse-mcp) usa la misma tabla y no cambia el veredicto de la primaria.

## Se publica siempre, sea cual sea el resultado
- Los numeros oficiales tal como salen de las filas y todas las sensibilidades que calcula `final.py`: coste por exito conforme, tareas donde ambas herramientas llegan a >= 2/3, dejando una tarea fuera, tasas de traspaso, timeout y finalizacion junto a la latencia activa, cumplimiento del flujo, tablas por tarea, y wall desde `duration_ms` de Claude Code.
- La division estatica/dinamica de coste y de contexto, para las dos comparaciones. La parte estatica (prompt del primer turno: stub o definiciones de herramientas, system prompt, tarea) procede del tamano de la interfaz, no de como se usa; el coste estatico es un modelo (prefijo escrito una vez y leido de cache en cada turno) y se etiqueta como tal.
- Las sensibilidades de cache que calcula `final.py`: primer turno con la misma escritura de cache para todas las ejecuciones, primer turno entero leido de cache, y cache fria (primer turno entero escrito), junto al coste tal como se informa.
- Las tareas excluidas con su motivo.

## Exclusiones
Solo por infraestructura (sitio caido, comprobador sin conexion con evidencia externa o por la regla automatica de "verdad no calculable en mas de la mitad de las ejecuciones de la tarea"), siempre para todas las variantes a la vez, con el motivo escrito. No se excluye ninguna tarea por su resultado, dificultad o porque una herramienta falle. Sin cambios de producto ni repeticiones selectivas despues de ver resultados.

## Limites conocidos (declarados de antemano)
- Un solo modelo (claude-sonnet-5-5): nada de lo medido se extrapola a otros modelos.
- Navegador headless y sin sesiones iniciadas: no se miden logins, 2FA, captchas resueltos por una persona ni sitios que exigen cuenta.
- Nuestro stub afinado frente al stub de serie de upstream: la comparacion primaria mide el fork con su texto para agentes frente a upstream con el suyo. Una parte de la diferencia puede deberse a que nuestro stub es autosuficiente (el agente no gasta un paso en `skills get core`) y no al codigo. Por eso se publica la division estatica/dinamica y el numero de pasos, y el primer paso de cada ejecucion queda en las transcripciones. No se afirma que el codigo, por si solo, explique el resultado.
- N=1: el IC capta la variacion entre tareas pero no la variacion entre repeticiones de la misma tarea; una sola ejecucion por celda puede estar dominada por el azar del modelo en tareas de limite.
- Un autor independiente para 40 tareas: la dificultad y el estilo de sitio son los suyos.
- La deteccion de "fetch fuera del navegador" en el codigo de browse es heuristica; `agent-browser read` se detecta por subcomando.
- El lint de textos (guard/lint-skill.ts) cubre blind4 cuando el archivo existe; blind3 no esta en el denylist, y r10.1 se escribio habiendo visto las tareas de r9 y de smoke (e2, h1, b13), no las de blind4.
- Humo previo a la ejecucion: 3 tareas ya vistas (e2, h1, b13), N=1, solo para comprobar que el stub de r10.1 elimina el preambulo `skills get` y que la tuberia funciona; no cuenta como resultado. Resultado: results/2026-11-14T12-20-22-smoke-r10-1. r10.1 abrio con una llamada `run` en las 3 tareas (1 paso, sin `skills get`); v043 abrio con `agent-browser skills get core | head -60` en las 3 (2, 9 y 11 pasos). Una de las 3 ejecuciones de v043 (e2) fallo con "browser failed to launch" tras 9 pasos; no se ha investigado si es del binario o de su uso de `--session`, y habra que mirarlo antes de fijar este preregistro.

## Valores fijados
- r10.1: tag r10.1 (de5ec986), binario release sha256 c0b4a3137fbe4b5ba5e40757d741109bcf6c8091148d55f8640f42b7b17e6c21.
- agent-browser oficial: v0.43.0 (1cc19526), binario release sha256 e423bf88f9d09a9be4fd630a00cea444937192ac3cbe0659f3194ef4ca90b866, con su guia sin modificar.
- browse 0.0.14, commit 8d247e6.
- Semilla 20261114. Comando: --variants ab-cli:r10,ab-cli:v043,browse-mcp --tasks blind4 --n 1 --seed 20261114 --static false.

## Notas conocidas antes de empezar
- Desde el commit 7049e9a, Chrome arranca con --no-sandbox en las variantes ab-cli para que las sesiones nuevas funcionen dentro del bloqueo de programas; antes fallaban (afecto a la prueba de humo de v043 y a dos ejecuciones de c18 en rondas anteriores).
- El arnes solo deja caliente la sesion por defecto. Si un agente abre sesiones con otro nombre, como invita la guia oficial, paga el arranque en frio de Chrome. Es comportamiento real de esa guia y se informa, no se corrige.

## Enmienda 1 (2026-11-14 14:56, antes de ejecutar)
- blind4/tasks.ts sha256 4e5c3937d5a3020ee51ab6231e5d25966433d23b350a7f453f30c08d521b5e0d, commit 6276a1e.

## Notas POST HOC (2026-11-14, tras la ejecucion y el informe; no cambian ninguna puerta ni fila)

1. Manifiesto del informe. `manifest-blind4.json` no existia en el commit congelado; se creo despues de la ejecucion y el informe solo funciono tras corregir sus claves: `primary` como lista `["ab-cli:r10","ab-cli:v043"]` y `secondary` como `"browse-mcp"`, ademas de `report: "r10"` y `group: "blind4"`. Es configuracion del informe, no toca filas ni calculos. Se versiona con la publicacion; el informe se regenera con `python3 src/final.py manifest-blind4.json --report r10`.
2. g20 (comprobador). El patron `forbidden` de g20, `/\.json\b|\/api\/|crandb|packages\.rds|PACKAGES/i`, es insensible a mayusculas y `PACKAGES` coincide con la ruta normal `cran.r-project.org/web/packages/<paquete>/index.html`, que es justo la pagina que pide la tarea. r10.1 y browse quedaron marcados `direct-url` por ese patron y v043 por la comprobacion de navegacion registrada sobre la misma pagina. Las tres respuestas eran correctas ("13; 12; 12; 37"), asi que g20 cuenta como acierto bruto y no conforme para las tres herramientas (conforme 36/40, bruto 37/40 cada una). No se repuntuo ninguna fila ni se retiro la tarea (la regla de exclusiones no lo permite por resultado); como afecta igual a las tres, no mueve ninguna razon, y el informe ya trae la sensibilidad sin las tareas que fallan todas (g4, g20, g26, g36: coste 0,57 [0,49, 0,68], contexto 0,75 [0,69, 0,82]).
3. Fallos de las otras tres tareas, iguales para las tres herramientas: g4 (las tres respondieron "51"), g26 (las tres "unable to determine" por un 403 del sitio) y g36 (respuesta distinta de la referencia; dos herramientas dieron Montreal, otra Nueva York, la referencia es Chicago). No se ha auditado si esas referencias son correctas; no se excluye ni repuntua nada.
4. Comando ejecutado frente al fijado. El log (`results/blind4-final.log`) muestra `--label blind4-final`, `--bins main=...,r10=...,v043=...` y `--static false` sin `--rules`; el preregistro fijaba `--label r10-blind4` y no citaba `main=`. `--rules` queda por defecto para blind4 (`rules_flag: "default-by-suite"`, `rules_v1_sha256` coincide con el congelado). Semilla, variantes, tareas y N como se fijaron. El preregistro mencionaba un bloqueo (`with-lock.sh`); el log no lo registra y no se verifica.
5. Commit del fork durante la ejecucion. `meta.json` registra `ab_commit` 0cb80568 para r10.1, no de5ec986 (el tag): un commit mas, que solo borra una linea del README del fork (insignia de producto). Los sha256 del binario y del stub coinciden con los congelados.
6. Version del cliente. La ejecucion uso Claude Code 2.1.325 (r9 uso 2.1.323). No estaba fijada en el preregistro.
7. Wall desde `duration_ms`. Segun el informe es 0,68 [0,57, 0,82] (fila de `duration_ms` de la sensibilidad); 0,84 [0,71, 0,98] es otra cifra del informe (coste frente a browse en las 36 tareas comunes), no un wall. El wall cobrado (puerta 4) es 0,71 [0,61, 0,84].
8. Orden de tareas. En `meta.json` la lista de tareas pone g25 al final; el orden de ejecucion lo fija la semilla (planRuns), no esa lista. No es una desviacion de contenido.
9. Titulo y frases de borrador. El titulo dice "BORRADOR para revision del coordinador, NO final" y quedan dos frases de borrador; el texto se fijo en el commit 1f93374 (13:49) y no se toco salvo la Enmienda 1 y estas notas.
10. Commit del arnes en las filas. Las filas registran harness_commit 2eb679a, no 7049e9a; la diferencia es solo blind4/tasks.ts y este preregistro.
11. Guia de upstream. v043 cargo la guia (`skills get core | head -60`) en 40/40 ejecuciones (+2021 tokens de mediana) y abrio sesion propia en 36/40; r10.1 en 0/40. Explica casi toda la diferencia de pico de contexto. (Comprobado en las transcripciones tras el informe: la cifra de sesion propia sale 36/40, no 37/40; las cuatro restantes son g6, g11, g13 y g36.)
12. IC del wall cobrado. El IC del wall cobrado sale 0,84 en la tabla de puertas y 0,85 en la tabla por pares (flujos de azar distintos).
