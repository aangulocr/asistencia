---
trigger: always_on
---

Lógica del Correo Institucional: Regla automática que valide que el campo email siempre se construya como cedula + "@est.mep.go.cr". Si el usuario intenta editarlo manualmente, el sistema debe revertirlo o bloquearlo.

Estado por Defecto de Asistencia: Configurar que, al instanciar un nuevo registro diario, la columna estado_id sea siempre 1 (Presencia de las cuatro lecciones) a menos que el profesor realice un cambio.

Restricción del Calendario Escolar: Regla que bloquee la selección de fechas fuera del rango del curso 2026 y que deshabilite los fines de semana (Sábado y Domingo).

Integridad de la Sección: Al seleccionar una sección en el calendario, la regla debe filtrar automáticamente la tabla de estudiantes para mostrar solo los pertenecientes a ese UUID de sección.

Cálculo del Dashboard: Definir la fórmula de agregación:

Total Lecciones: Registros x 4.

Ausentismo: Una función que sume el peso de cada una de las 12 opciones (ej. Opción 2 suma 4 ausencias, Opción 8 suma 1 ausencia).