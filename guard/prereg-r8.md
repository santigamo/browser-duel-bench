# Evaluacion ciega de r8: plan fijado antes de ver las tareas

Fijado el 2026-11-08 por el coordinador, despues del resultado de r7 y de la reparacion del harness. No se cambia despues de ver las tareas.

## Congelado
- r8: tag r8 (6749ab39), binario release sha256 54ea06c86d65a4ae...
- r7: tag r7 (ec3d72156), binario release sha256 edef54968c0f24ce...
- Harness: commit f080c6f, salvo el archivo de tareas blind2. Shell del CLI restringido a solo navegador.

## Diseno
- 20 tareas nuevas (c1-c20) de un autor independiente. Coordinador y desarrollo no leen el contenido antes del informe.
- Variantes: ab-cli:r8, ab-cli:r7, browse-mcp. Modelo principal claude-sonnet-5-5, N=3. Segundo modelo gpt-6.1-sol, N=1, direccional.
- Navegador caliente, orden aleatorio por bloque con semilla registrada.

## Umbrales (r8 / browse, modelo principal, geomedia por tarea, bootstrap jerarquico 95 %)
- Exito conforme: r8 no por debajo de browse. No se exige 60/60: en la ronda anterior habia tareas imposibles para todas las herramientas.
- Tiempo: punto <= 0,90 y cota superior < 1.
- Coste real: punto <= 0,90 y cota superior < 1.
- Pico de contexto: punto <= 0,90 y cota superior < 1.
- Pasos: solo descriptivo.

## Eleccion de base (r8 / r7)
r8 sustituye a r7 si su exito conforme no es menor y ninguno de tiempo, coste y contexto empeora mas de un 5 % en el punto. Si no, la base sigue siendo r7.

## Reglas
- Exclusion de tareas solo con evidencia externa de infraestructura caida y para todas las variantes.
- Se publican tasas de timeout, tiempo con censura, sensibilidad dejando una tarea fuera y las tablas por tarea.
- Sin cambios de producto ni repeticiones selectivas despues de ver resultados. Un fallo de umbral se informa como fallo.

## Desviacion 1 (2026-11-08, antes de la primera ejecucion)
c16 se excluye para todas las variantes: su web devolvio HTTP 429 al comprobador en 7 intentos durante una hora, asi que la verdad no se puede calcular. Quedan 19 tareas. El autor de las tareas valido contra esa web poco antes, lo que probablemente provoco el limite.
