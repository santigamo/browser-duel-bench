# Resultado de la evaluacion ciega de r7

Fecha: 2026-11-08. Plan y umbrales: guard/prereg-r7.md (con enmienda 1 y desviacion 1). r7 = ec3d72156. 20 tareas ciegas.

## Modelo principal: claude-sonnet-5-5, N=3, ab-cli:r7 / browse-mcp (geomedia por tarea, bootstrap jerarquico 95 %)

| criterio | resultado | IC 95 % | cumple |
|---|---|---|---|
| Exito conforme | 47/60 vs 50/60 | | no |
| Tiempo <= 0,90 | 0,757 | 0,437-1,395 | no (cota >= 1) |
| Coste real <= 0,90 | 0,854 | 0,659-1,152 | no (cota >= 1) |
| Pico de contexto <= 0,90 | 0,585 | 0,526-0,667 | si |
| Pasos (descriptivo) | 1,189 | 0,853-1,674 | |

Veredicto: no supera a browse segun los umbrales fijados. Ventaja robusta solo en contexto.

Sensibilidad: sin b9 (web con verificacion humana, comprobador sin conexion): tiempo 0,911, coste 0,900, contexto 0,593. Sin b9 y b11 (5 timeouts de browse): tiempo 1,108, coste 0,900, contexto 0,597.
Cinco ejecuciones de browse sin coste registrado por timeout.

Respuesta correcta: 51/60 vs 50/60. r7 pierde 4 por reglas (2 API directa, 1 curl, 1 python3).
Falso negativo detectado despues: b3 r7 reps 2 y 3 visitaron las paginas con URL construida en un bucle; la evidencia busca la URL literal. Sin corregir en el resultado oficial; con ella seria 49/60 vs 50/60.

## Segundo modelo: gpt-6.1-sol, N=1 (direccional)

Tiempo 0,729, coste proxy 0,414, pasos 0,716. Evidencia no evaluable: transcriptFromEvents no entiende el formato de Codex y marca evidencia ausente en ambas variantes; exito conforme no medible.
