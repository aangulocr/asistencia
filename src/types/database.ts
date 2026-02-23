export type Json =
    | string
    | number
    | boolean
    | null
    | { [key: string]: Json | undefined }
    | Json[]

export type Database = {
    public: {
        Tables: {
            secciones: {
                Row: {
                    id: string
                    nombre: string
                }
                Insert: {
                    id?: string
                    nombre: string
                }
                Update: {
                    id?: string
                    nombre?: string
                }
            }
            estados_asistencia: {
                Row: {
                    id: number
                    nombre: string
                    peso_ausencia: number
                    es_justificada: boolean
                }
                Insert: {
                    id: number
                    nombre: string
                    peso_ausencia?: number
                    es_justificada?: boolean
                }
                Update: {
                    id?: number
                    nombre?: string
                    peso_ausencia?: number
                    es_justificada?: boolean
                }
            }
            estudiantes: {
                Row: {
                    cedula: string
                    nombre: string
                    apellidos: string
                    email: string | null
                    seccion_id: string | null
                }
                Insert: {
                    cedula: string
                    nombre: string
                    apellidos: string
                    email?: string | null
                    seccion_id?: string | null
                }
                Update: {
                    cedula?: string
                    nombre?: string
                    apellidos?: string
                    email?: string | null
                    seccion_id?: string | null
                }
            }
            control_asistencia: {
                Row: {
                    id: string
                    estudiante_id: string
                    seccion_id: string
                    fecha: string
                    estado_id: number
                    created_at: string
                }
                Insert: {
                    id?: string
                    estudiante_id: string
                    seccion_id: string
                    fecha: string
                    estado_id?: number
                    created_at?: string
                }
                Update: {
                    id?: string
                    estudiante_id?: string
                    seccion_id?: string
                    fecha?: string
                    estado_id?: number
                    created_at?: string
                }
            }
            configuracion_diaria: {
                Row: {
                    id: string
                    seccion_id: string
                    fecha: string
                    lecciones_totales: number
                }
                Insert: {
                    id?: string
                    seccion_id: string
                    fecha: string
                    lecciones_totales: number
                }
                Update: {
                    id?: string
                    seccion_id?: string
                    fecha?: string
                    lecciones_totales?: number
                }
            }
            trabajos_cotidianos: {
                Row: {
                    id: number
                    nombre: string
                    seccion_id: string
                    fecha: string
                    created_at: string
                }
                Insert: {
                    id?: number
                    nombre: string
                    seccion_id: string
                    fecha?: string
                    created_at?: string
                }
                Update: {
                    id?: number
                    nombre?: string
                    seccion_id?: string
                    fecha?: string
                    created_at?: string
                }
            }
            indicadores: {
                Row: {
                    id: string
                    trabajo_id: number
                    titulo: string
                    orden: number
                    desc_0: string | null
                    desc_1: string | null
                    desc_2: string | null
                    desc_3: string | null
                }
                Insert: {
                    id?: string
                    trabajo_id: number
                    titulo: string
                    orden: number
                    desc_0?: string | null
                    desc_1?: string | null
                    desc_2?: string | null
                    desc_3?: string | null
                }
                Update: {
                    id?: string
                    trabajo_id?: number
                    titulo?: string
                    orden?: number
                    desc_0?: string | null
                    desc_1?: string | null
                    desc_2?: string | null
                    desc_3?: string | null
                }
            }
            evaluaciones_cotidiano: {
                Row: {
                    id: string
                    estudiante_id: string
                    indicador_id: string
                    puntaje: number | null
                }
                Insert: {
                    id?: string
                    estudiante_id: string
                    indicador_id: string
                    puntaje?: number | null
                }
                Update: {
                    id?: string
                    estudiante_id?: string
                    indicador_id?: string
                    puntaje?: number | null
                }
            }
            tareas: {
                Row: {
                    id: number
                    nombre: string
                    seccion_id: string
                    porcentaje: number
                    puntos_totales: number
                    fecha: string
                    created_at: string
                }
                Insert: {
                    id?: number
                    nombre: string
                    seccion_id: string
                    porcentaje?: number
                    puntos_totales?: number
                    fecha?: string
                    created_at?: string
                }
                Update: {
                    id?: number
                    nombre?: string
                    seccion_id?: string
                    porcentaje?: number
                    puntos_totales?: number
                    fecha?: string
                    created_at?: string
                }
            }
            indicadores_tarea: {
                Row: {
                    id: string
                    tarea_id: number
                    titulo: string
                    orden: number
                    desc_0: string | null
                    desc_1: string | null
                    desc_2: string | null
                    desc_3: string | null
                }
                Insert: {
                    id?: string
                    tarea_id: number
                    titulo: string
                    orden: number
                    desc_0?: string | null
                    desc_1?: string | null
                    desc_2?: string | null
                    desc_3?: string | null
                }
                Update: {
                    id?: string
                    tarea_id?: number
                    titulo?: string
                    orden?: number
                    desc_0?: string | null
                    desc_1?: string | null
                    desc_2?: string | null
                    desc_3?: string | null
                }
            }
            evaluaciones_tarea: {
                Row: {
                    id: string
                    estudiante_id: string
                    indicador_id: string
                    puntaje: number | null
                }
                Insert: {
                    id?: string
                    estudiante_id: string
                    indicador_id: string
                    puntaje?: number | null
                }
                Update: {
                    id?: string
                    estudiante_id?: string
                    indicador_id?: string
                    puntaje?: number | null
                }
            }
            examenes: {
                Row: {
                    id: number
                    nombre: string
                    seccion_id: string
                    porcentaje: number
                    puntos_totales: number
                    fecha: string
                    created_at: string
                }
                Insert: {
                    id?: number
                    nombre: string
                    seccion_id: string
                    porcentaje?: number
                    puntos_totales?: number
                    fecha?: string
                    created_at?: string
                }
                Update: {
                    id?: number
                    nombre?: string
                    seccion_id?: string
                    porcentaje?: number
                    puntos_totales?: number
                    fecha?: string
                    created_at?: string
                }
            }
            indicadores_examen: {
                Row: {
                    id: string
                    examen_id: number
                    titulo: string
                    orden: number
                    desc_0: string | null
                    desc_1: string | null
                    desc_2: string | null
                    desc_3: string | null
                }
                Insert: {
                    id?: string
                    examen_id: number
                    titulo: string
                    orden: number
                    desc_0?: string | null
                    desc_1?: string | null
                    desc_2?: string | null
                    desc_3?: string | null
                }
                Update: {
                    id?: string
                    examen_id?: number
                    titulo?: string
                    orden?: number
                    desc_0?: string | null
                    desc_1?: string | null
                    desc_2?: string | null
                    desc_3?: string | null
                }
            }
            evaluaciones_examen: {
                Row: {
                    id: string
                    estudiante_id: string
                    indicador_id: string
                    puntaje: number | null
                }
                Insert: {
                    id?: string
                    estudiante_id: string
                    indicador_id: string
                    puntaje?: number | null
                }
                Update: {
                    id?: string
                    estudiante_id?: string
                    indicador_id?: string
                    puntaje?: number | null
                }
            }

        }
    }
}
