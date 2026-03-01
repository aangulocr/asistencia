-- ==========================================
-- ESQUEMA UNIFICADO DE BASE DE DATOS SUPABASE
-- PROYECTO: CONTROL DE ASISTENCIA Y EVALUACIÓN 2026
-- ==========================================

-- 1. Extensiones
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Limpieza (Opcional: solo si se desea recrear todo)
-- DROP TABLE IF EXISTS evaluaciones_examen CASCADE;
-- DROP TABLE IF EXISTS indicadores_examen CASCADE;
-- DROP TABLE IF EXISTS examenes CASCADE;
-- DROP TABLE IF EXISTS evaluaciones_tarea CASCADE;
-- DROP TABLE IF EXISTS indicadores_tarea CASCADE;
-- DROP TABLE IF EXISTS tareas CASCADE;
-- DROP TABLE IF EXISTS evaluaciones_cotidiano CASCADE;
-- DROP TABLE IF EXISTS indicadores CASCADE;
-- DROP TABLE IF EXISTS trabajos_cotidianos CASCADE;
-- DROP TABLE IF EXISTS control_asistencia CASCADE;
-- DROP TABLE IF EXISTS configuracion_diaria CASCADE;
-- DROP TABLE IF EXISTS estudiantes CASCADE;
-- DROP TABLE IF EXISTS estados_asistencia CASCADE;
-- DROP TABLE IF EXISTS secciones CASCADE;

-- 3. Tablas Base

-- Secciones
CREATE TABLE secciones (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre TEXT NOT NULL UNIQUE, -- ej. '10-1'
    nivel INTEGER NOT NULL CHECK (nivel IN (10, 11))
);

-- Estados de Asistencia
CREATE TABLE estados_asistencia (
    id INTEGER PRIMARY KEY,
    nombre TEXT NOT NULL,
    peso_ausencia NUMERIC NOT NULL DEFAULT 0,
    es_justificada BOOLEAN DEFAULT FALSE
);

-- Estudiantes
CREATE TABLE estudiantes (
    cedula TEXT PRIMARY KEY,
    nombre TEXT NOT NULL,
    apellidos TEXT NOT NULL,
    email TEXT, -- Generado por trigger
    seccion_id UUID REFERENCES secciones(id) ON DELETE CASCADE
);

-- 4. Triggers y Funciones de Estudiantes
CREATE OR REPLACE FUNCTION process_student_data()
RETURNS TRIGGER AS $$
BEGIN
    NEW.nombre := UPPER(NEW.nombre);
    NEW.apellidos := UPPER(NEW.apellidos);
    NEW.email := NEW.cedula || '@est.mep.go.cr';
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_process_student
BEFORE INSERT OR UPDATE OF cedula, nombre, apellidos ON estudiantes
FOR EACH ROW
EXECUTE FUNCTION process_student_data();

-- 5. Control de Asistencia y Configuración Diaria

-- Configuración Diaria (Lecciones por día)
CREATE TABLE configuracion_diaria (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    seccion_id UUID REFERENCES secciones(id) ON DELETE CASCADE,
    fecha DATE NOT NULL,
    periodo INTEGER NOT NULL DEFAULT 1 CHECK (periodo IN (1, 2)),
    lecciones_totales INTEGER NOT NULL DEFAULT 4 CHECK (lecciones_totales BETWEEN 1 AND 4),
    observaciones TEXT,
    -- Restricción Calendario 2026 y No Fines de Semana
    CONSTRAINT check_fecha_2026_config CHECK (
        EXTRACT(YEAR FROM fecha) = 2026 AND 
        EXTRACT(DOW FROM fecha) NOT IN (0, 6)
    ),
    UNIQUE(seccion_id, fecha, periodo)
);

-- Registro de Asistencia
CREATE TABLE control_asistencia (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    estudiante_id TEXT REFERENCES estudiantes(cedula) ON DELETE CASCADE,
    seccion_id UUID REFERENCES secciones(id) ON DELETE CASCADE,
    fecha DATE NOT NULL,
    periodo INTEGER NOT NULL DEFAULT 1 CHECK (periodo IN (1, 2)),
    estado_id INTEGER REFERENCES estados_asistencia(id) DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    -- Restricción Calendario 2026 y No Fines de Semana
    CONSTRAINT check_fecha_2026_asistencia CHECK (
        EXTRACT(YEAR FROM fecha) = 2026 AND 
        EXTRACT(DOW FROM fecha) NOT IN (0, 6)
    ),
    UNIQUE(estudiante_id, fecha, periodo)
);

-- 6. Evaluación: Trabajo Cotidiano

CREATE TABLE trabajos_cotidianos (
    id SERIAL PRIMARY KEY,
    nombre TEXT NOT NULL,
    seccion_id UUID REFERENCES secciones(id) ON DELETE CASCADE,
    periodo INTEGER NOT NULL DEFAULT 1 CHECK (periodo IN (1, 2)),
    fecha DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE indicadores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    trabajo_id INT REFERENCES trabajos_cotidianos(id) ON DELETE CASCADE,
    titulo TEXT NOT NULL,
    orden INT NOT NULL,
    desc_0 TEXT DEFAULT 'No evidencia',
    desc_1 TEXT DEFAULT 'No logrado',
    desc_2 TEXT DEFAULT 'En proceso',
    desc_3 TEXT DEFAULT 'Logrado'
);

CREATE TABLE evaluaciones_cotidiano (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    estudiante_id TEXT REFERENCES estudiantes(cedula) ON DELETE CASCADE,
    indicador_id UUID REFERENCES indicadores(id) ON DELETE CASCADE,
    puntaje INT NOT NULL DEFAULT 0 CHECK (puntaje >= 0 AND puntaje <= 3),
    UNIQUE(estudiante_id, indicador_id)
);

-- 7. Evaluación: Tareas

CREATE TABLE tareas (
    id SERIAL PRIMARY KEY,
    nombre TEXT NOT NULL,
    seccion_id UUID REFERENCES secciones(id) ON DELETE CASCADE,
    periodo INTEGER NOT NULL DEFAULT 1 CHECK (periodo IN (1, 2)),
    porcentaje FLOAT NOT NULL DEFAULT 5.0,
    puntos_totales INT NOT NULL DEFAULT 10,
    fecha DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE indicadores_tarea (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tarea_id INT REFERENCES tareas(id) ON DELETE CASCADE,
    titulo TEXT NOT NULL,
    orden INT NOT NULL,
    desc_0 TEXT,
    desc_1 TEXT,
    desc_2 TEXT,
    desc_3 TEXT
);

CREATE TABLE evaluaciones_tarea (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    estudiante_id TEXT REFERENCES estudiantes(cedula) ON DELETE CASCADE,
    indicador_id UUID REFERENCES indicadores_tarea(id) ON DELETE CASCADE,
    puntaje INT NOT NULL DEFAULT 0 CHECK (puntaje >= 0 AND puntaje <= 3),
    UNIQUE(estudiante_id, indicador_id)
);

-- 8. Evaluación: Exámenes

CREATE TABLE examenes (
    id SERIAL PRIMARY KEY,
    nombre TEXT NOT NULL,
    seccion_id UUID REFERENCES secciones(id) ON DELETE CASCADE,
    periodo INTEGER NOT NULL DEFAULT 1 CHECK (periodo IN (1, 2)),
    porcentaje FLOAT NOT NULL DEFAULT 25.0,
    puntos_totales INT NOT NULL DEFAULT 30,
    fecha DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE indicadores_examen (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    examen_id INT REFERENCES examenes(id) ON DELETE CASCADE,
    titulo TEXT NOT NULL,
    orden INT NOT NULL,
    desc_0 TEXT,
    desc_1 TEXT,
    desc_2 TEXT,
    desc_3 TEXT
);

CREATE TABLE evaluaciones_examen (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    estudiante_id TEXT REFERENCES estudiantes(cedula) ON DELETE CASCADE,
    indicador_id UUID REFERENCES indicadores_examen(id) ON DELETE CASCADE,
    puntaje INT NOT NULL DEFAULT 0 CHECK (puntaje >= 0 AND puntaje <= 3),
    UNIQUE(estudiante_id, indicador_id)
);

-- 9. Row Level Security (RLS)
ALTER TABLE secciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE estados_asistencia ENABLE ROW LEVEL SECURITY;
ALTER TABLE estudiantes ENABLE ROW LEVEL SECURITY;
ALTER TABLE control_asistencia ENABLE ROW LEVEL SECURITY;
ALTER TABLE configuracion_diaria ENABLE ROW LEVEL SECURITY;
ALTER TABLE trabajos_cotidianos ENABLE ROW LEVEL SECURITY;
ALTER TABLE indicadores ENABLE ROW LEVEL SECURITY;
ALTER TABLE evaluaciones_cotidiano ENABLE ROW LEVEL SECURITY;
ALTER TABLE tareas ENABLE ROW LEVEL SECURITY;
ALTER TABLE indicadores_tarea ENABLE ROW LEVEL SECURITY;
ALTER TABLE evaluaciones_tarea ENABLE ROW LEVEL SECURITY;
ALTER TABLE examenes ENABLE ROW LEVEL SECURITY;
ALTER TABLE indicadores_examen ENABLE ROW LEVEL SECURITY;
ALTER TABLE evaluaciones_examen ENABLE ROW LEVEL SECURITY;

-- Políticas de Acceso Completo (Público para desarrollo/anon)
CREATE POLICY "Public full access sections" ON secciones FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public full access estados" ON estados_asistencia FOR SELECT USING (true);
CREATE POLICY "Public full access students" ON estudiantes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public full access attendance" ON control_asistencia FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public full access config" ON configuracion_diaria FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public full access TC" ON trabajos_cotidianos FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public full access indicadores" ON indicadores FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public full access evaluaciones" ON evaluaciones_cotidiano FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public full access tareas" ON tareas FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public full access ind_tareas" ON indicadores_tarea FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public full access eval_tareas" ON evaluaciones_tarea FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public full access examenes" ON examenes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public full access ind_examenes" ON indicadores_examen FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public full access eval_examenes" ON evaluaciones_examen FOR ALL USING (true) WITH CHECK (true);

-- 10. Datos Iniciales Obligatorios

-- Estados de Asistencia (12 variantes según requerimiento)
INSERT INTO estados_asistencia (id, nombre, peso_ausencia, es_justificada) VALUES
(1, 'Presencia total', 0, FALSE),
(2, 'Ausencia total (4 lecciones)', 4, FALSE),
(3, 'Ausencia 1° lección', 1, FALSE),
(4, 'Ausencia 1° y 2° lección', 2, FALSE),
(5, 'Ausencia 1°, 2° y 3° lección', 3, FALSE),
(6, 'Tardía 1° lección', 0.5, FALSE),
(7, 'Tardía 3° lección', 0.5, FALSE),
(8, 'Ausencia 1° + Tardía 2°', 1.5, FALSE),
(9, 'Ausencia 1° y 2° + Tardía 3°', 2.5, FALSE),
(10, 'Ausencia 1°, 2° y 3° + Tardía 4°', 3.5, FALSE),
(11, 'Escapes (2°, 3° o 4° lección)', 1, FALSE),
(12, 'Justificación', 0, TRUE)
ON CONFLICT (id) DO UPDATE SET 
    nombre = EXCLUDED.nombre, 
    peso_ausencia = EXCLUDED.peso_ausencia, 
    es_justificada = EXCLUDED.es_justificada;

-- Secciones Iniciales
INSERT INTO secciones (nombre, nivel) VALUES 
('10-1', 10), ('10-2', 10), ('10-3', 10),
('11-1', 11), ('11-2', 11), ('11-3', 11)
ON CONFLICT (nombre) DO NOTHING;
