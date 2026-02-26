export type Json =
    | string
    | number
    | boolean
    | null
    | { [key: string]: Json | undefined }
    | Json[]

export interface Database {
    public: {
        Tables: {
            secciones: {
                Row: { id: string; nombre: string }
                Insert: { id?: string; nombre: string }
                Update: { id?: string; nombre?: string }
                Relationships: []
            }
            estados_asistencia: {
                Row: { id: number; nombre: string; peso_ausencia: number; es_justificada: boolean }
                Insert: { id: number; nombre: string; peso_ausencia?: number; es_justificada?: boolean }
                Update: { id?: number; nombre?: string; peso_ausencia?: number; es_justificada?: boolean }
                Relationships: []
            }
            estudiantes: {
                Row: { cedula: string; nombre: string; apellidos: string; email: string | null; seccion_id: string | null }
                Insert: { cedula: string; nombre: string; apellidos: string; email?: string | null; seccion_id?: string | null }
                Update: { cedula?: string; nombre?: string; apellidos?: string; email?: string | null; seccion_id?: string | null }
                Relationships: []
            }
            control_asistencia: {
                Row: { id: string; estudiante_id: string; seccion_id: string; fecha: string; estado_id: number; periodo: number; created_at: string }
                Insert: { id?: string; estudiante_id: string; seccion_id: string; fecha: string; estado_id?: number; periodo?: number; created_at?: string }
                Update: { id?: string; estudiante_id?: string; seccion_id?: string; fecha?: string; estado_id?: number; periodo?: number; created_at?: string }
                Relationships: []
            }
            configuracion_diaria: {
                Row: { id: string; seccion_id: string; fecha: string; lecciones_totales: number; periodo: number; observaciones: string | null }
                Insert: { id?: string; seccion_id: string; fecha: string; lecciones_totales: number; periodo?: number; observaciones?: string | null }
                Update: { id?: string; seccion_id?: string; fecha?: string; lecciones_totales?: number; periodo?: number; observaciones?: string | null }
                Relationships: []
            }
            trabajos_cotidianos: {
                Row: { id: number; nombre: string; seccion_id: string; fecha: string; periodo: number; created_at: string }
                Insert: { id?: number; nombre: string; seccion_id: string; fecha?: string; periodo?: number; created_at?: string }
                Update: { id?: number; nombre?: string; seccion_id?: string; fecha?: string; periodo?: number; created_at?: string }
                Relationships: []
            }
            indicadores: {
                Row: { id: string; trabajo_id: number; titulo: string; orden: number; desc_0: string | null; desc_1: string | null; desc_2: string | null; desc_3: string | null }
                Insert: { id?: string; trabajo_id: number; titulo: string; orden: number; desc_0?: string | null; desc_1?: string | null; desc_2?: string | null; desc_3?: string | null }
                Update: { id?: string; trabajo_id?: number; titulo?: string; orden?: number; desc_0?: string | null; desc_1?: string | null; desc_2?: string | null; desc_3?: string | null }
                Relationships: []
            }
            evaluaciones_cotidiano: {
                Row: { id: string; estudiante_id: string; indicador_id: string; puntaje: number | null }
                Insert: { id?: string; estudiante_id: string; indicador_id: string; puntaje?: number | null }
                Update: { id?: string; estudiante_id?: string; indicador_id?: string; puntaje?: number | null }
                Relationships: []
            }
            tareas: {
                Row: { id: number; nombre: string; seccion_id: string; porcentaje: number; puntos_totales: number; fecha: string; periodo: number; created_at: string }
                Insert: { id?: number; nombre: string; seccion_id: string; porcentaje?: number; puntos_totales?: number; fecha?: string; periodo?: number; created_at?: string }
                Update: { id?: number; nombre?: string; seccion_id?: string; porcentaje?: number; puntos_totales?: number; fecha?: string; periodo?: number; created_at?: string }
                Relationships: []
            }
            indicadores_tarea: {
                Row: { id: string; tarea_id: number; titulo: string; orden: number; desc_0: string | null; desc_1: string | null; desc_2: string | null; desc_3: string | null }
                Insert: { id?: string; tarea_id: number; titulo: string; orden: number; desc_0?: string | null; desc_1?: string | null; desc_2?: string | null; desc_3?: string | null }
                Update: { id?: string; tarea_id?: number; titulo?: string; orden?: number; desc_0?: string | null; desc_1?: string | null; desc_2?: string | null; desc_3?: string | null }
                Relationships: []
            }
            evaluaciones_tarea: {
                Row: { id: string; estudiante_id: string; indicador_id: string; puntaje: number | null }
                Insert: { id?: string; estudiante_id: string; indicador_id: string; puntaje?: number | null }
                Update: { id?: string; estudiante_id?: string; indicador_id?: string; puntaje?: number | null }
                Relationships: []
            }
            examenes: {
                Row: { id: number; nombre: string; seccion_id: string; porcentaje: number; puntos_totales: number; fecha: string; periodo: number; created_at: string }
                Insert: { id?: number; nombre: string; seccion_id: string; porcentaje?: number; puntos_totales?: number; fecha?: string; periodo?: number; created_at?: string }
                Update: { id?: number; nombre?: string; seccion_id?: string; porcentaje?: number; puntos_totales?: number; fecha?: string; periodo?: number; created_at?: string }
                Relationships: []
            }
            indicadores_examen: {
                Row: { id: string; examen_id: number; titulo: string; orden: number; desc_0: string | null; desc_1: string | null; desc_2: string | null; desc_3: string | null }
                Insert: { id?: string; examen_id: number; titulo: string; orden: number; desc_0?: string | null; desc_1?: string | null; desc_2?: string | null; desc_3?: string | null }
                Update: { id?: string; examen_id?: number; titulo?: string; orden?: number; desc_0?: string | null; desc_1?: string | null; desc_2?: string | null; desc_3?: string | null }
                Relationships: []
            }
            evaluaciones_examen: {
                Row: { id: string; estudiante_id: string; indicador_id: string; puntaje: number | null }
                Insert: { id?: string; estudiante_id: string; indicador_id: string; puntaje?: number | null }
                Update: { id?: string; estudiante_id?: string; indicador_id?: string; puntaje?: number | null }
                Relationships: []
            }
        }
        Views: { [_ in never]: never }
        Functions: { [_ in never]: never }
        Enums: { [_ in never]: never }
        CompositeTypes: { [_ in never]: never }
    }
}
