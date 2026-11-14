# Regla de traspaso a humano (handoff)

Aplica a todas las herramientas y a todos los modelos. Implementada en src/handoff.ts (deteccion), src/run.ts (en vivo) y src/handoff-posthoc.ts (sobre transcripciones guardadas). Las dos reutilizan el mismo detector.

## Que cuenta
Un traspaso es la peticion explicita del agente de que una persona actue en el navegador. En un benchmark sin cabeza nadie responde, asi que la llamada se queda esperando hasta el timeout fijo (420 s) y esa espera no es trabajo activo.

- browse: una llamada `handoff(...)` dentro del codigo de su herramienta `execute` (campo `code`). Verificado en las transcripciones c10-browse-mcp-1/3 y c18-browse-mcp-2/3 de blind2 y b9/b11 de blind1: no existe una herramienta MCP aparte para el traspaso (las 18 herramientas anunciadas son execute, status, session_*, secrets_*, etc.); el traspaso es solo esa funcion. La comparacion ignora comentarios JS y no cuenta la palabra `handoff` en cadenas de resultado (browse devuelve `"handoffs":0` y `recommendation: "handoff"` en sus resultados: eso no es una peticion del agente).
- Cualquier otra herramienta: una herramienta MCP cuyo nombre sea handoff / hand_off / request_human / ask_human / human_handoff, o `handoff(...)` en los campos de codigo (`code`, `script`, `expression`, `source`, `js`) de cualquier herramienta. Items de Codex (`mcp_tool_call`, `command_execution`) se leen igual.
- ab-cli: agent-browser no tiene hoy ninguna primitiva de traspaso a humano. Cuenta solo una orden de shell que invoque un subcomando `handoff`, `hand-off` o `takeover` de agent-browser (hoy no existe: 0 casos en las 174 ejecuciones ab-cli almacenadas (60 + 57 + 57), verificado). NO cuentan: que el agente escriba en su mensaje final que una persona deberia resolver algo (la ejecucion termina sola y el comprobador la puntua), el aviso `Action requires confirmation` de la politica de acciones (el propio agente puede contestarlo con `confirm`), ni `needs_parent` de act (es el agente padre, no una persona).

## Que se hace
- Se detecta la primera peticion. En vivo se mata el proceso en ese momento; post hoc se corta la transcripcion en ese evento.
- status=handoff, success=false, clean=false, timed_out=false. No es un timeout: el timeout fijo queda solo para ejecucion activa sin resolver.
- Se cobra tiempo y coste solo hasta ese evento. En vivo: wall_s = instante del evento desde el arranque; la espera real queda en wall_raw_s. Post hoc: wall_s = wall registrado menos lo ocurrido despues de que empezo la llamada (ultimo evento con marca de tiempo menos la marca de la llamada). Coste: uso de los turnos hasta e incluida la llamada, precio ajustado (src/price-fit.json), etiquetado como estimacion (cost_src=estimate, cost_partial=true), igual que cualquier ejecucion cortada.
- Pasos, pico y primer turno de contexto y tokens tambien hasta ese evento.
- `--handoff ignore` en run.ts restaura el comportamiento anterior (solo para reproducir resultados antiguos).

## Como se informa
src/final.py publica la tasa de traspaso junto a la tasa de timeout y la tasa de finalizacion (ejecuciones que terminan por si solas) al lado de la latencia activa (wall cobrado). Un traspaso nunca cuenta como exito conforme ni se oculta: es un fallo de finalizacion de la herramienta en un entorno sin humano.

## Limites conocidos
- El detector no puede ver traspasos disfrazados (por ejemplo pedir en prosa y esperar con sleep): se contarian como actividad.
- Un `handoff()` dentro de una cadena de codigo no ejecutada se cuenta igual; es raro y esta aceptado.
