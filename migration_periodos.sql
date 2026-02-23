-- Migration: Add 'periodo' column to support two semesters (1 and 2)

-- 1. Update trabajos_cotidianos
ALTER TABLE trabajos_cotidianos ADD COLUMN periodo INTEGER NOT NULL DEFAULT 1 CHECK (periodo IN (1, 2));

-- 2. Update tareas
ALTER TABLE tareas ADD COLUMN periodo INTEGER NOT NULL DEFAULT 1 CHECK (periodo IN (1, 2));

-- 3. Update examenes
ALTER TABLE examenes ADD COLUMN periodo INTEGER NOT NULL DEFAULT 1 CHECK (periodo IN (1, 2));

-- 4. Update configuracion_diaria
-- We need to drop the unique constraint first because it now depends on the period
ALTER TABLE configuracion_diaria DROP CONSTRAINT IF EXISTS configuracion_diaria_seccion_id_fecha_key;
ALTER TABLE configuracion_diaria ADD COLUMN periodo INTEGER NOT NULL DEFAULT 1 CHECK (periodo IN (1, 2));
ALTER TABLE configuracion_diaria ADD CONSTRAINT configuracion_diaria_seccion_id_fecha_periodo_key UNIQUE(seccion_id, fecha, periodo);

-- 5. Update control_asistencia
ALTER TABLE control_asistencia DROP CONSTRAINT IF EXISTS control_asistencia_estudiante_id_fecha_key;
ALTER TABLE control_asistencia ADD COLUMN periodo INTEGER NOT NULL DEFAULT 1 CHECK (periodo IN (1, 2));
ALTER TABLE control_asistencia ADD CONSTRAINT control_asistencia_estudiante_id_fecha_periodo_key UNIQUE(estudiante_id, fecha, periodo);

-- Note: Existing data will default to Period 1.
