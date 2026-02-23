import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Database } from '../types/database';

interface Props {
    seccionId: string;
    periodo: number;
}

export function Dashboard({ seccionId, periodo }: Props) {
    const [stats, setStats] = useState({
        leccionesProgramadas: 0,
        ausenciasPromedio: 0,
        porcentaje: 0
    });

    useEffect(() => {
        calculateStats();
    }, [seccionId, periodo]);

    async function calculateStats() {
        // 1. Get student count
        const { count: studentCount } = await supabase
            .from('estudiantes')
            .select('*', { count: 'exact', head: true })
            .eq('seccion_id', seccionId);

        const totalStudents = studentCount || 1;

        // 2. Get attendance records
        const { data: attendanceData } = await supabase
            .from('control_asistencia')
            .select('fecha, estado_id, estados_asistencia(peso_ausencia)')
            .eq('seccion_id', seccionId)
            .eq('periodo', periodo);

        // 3. Get daily configurations
        const { data: configData } = await supabase
            .from('configuracion_diaria')
            .select('fecha, lecciones_totales')
            .eq('seccion_id', seccionId)
            .eq('periodo', periodo);

        const configMap: Record<string, number> = {};
        const typedConfig = configData as Database['public']['Tables']['configuracion_diaria']['Row'][] | null;
        typedConfig?.forEach(c => {
            configMap[c.fecha] = c.lecciones_totales;
        });

        // Calculate unique dates with records to get "Total Programmed Lessons"
        const typedAttendance = attendanceData as Database['public']['Tables']['control_asistencia']['Row'][] | null;
        const uniqueDates = Array.from(new Set(typedAttendance?.map(a => a.fecha) || []));
        let leccionesProgramadas = 0;
        uniqueDates.forEach(date => {
            leccionesProgramadas += configMap[date] || 4;
        });

        let sumAbsenceWeights = 0;
        typedAttendance?.forEach((r: any) => {
            const lessonsToday = configMap[r.fecha] || 4;
            let peso = r.estados_asistencia?.peso_ausencia || 0;
            if (peso > 0) {
                // Scale weight proportionally to today's lessons
                peso = (peso / 4) * lessonsToday;
                sumAbsenceWeights += peso;
            }
        });

        const ausenciasPromedio = sumAbsenceWeights / totalStudents;
        const porcentaje = leccionesProgramadas > 0 ? (ausenciasPromedio / leccionesProgramadas) * 100 : 0;

        setStats({
            leccionesProgramadas,
            ausenciasPromedio: parseFloat(ausenciasPromedio.toFixed(2)),
            porcentaje: parseFloat(porcentaje.toFixed(2))
        });
    }

    return (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
            <div className="glass-card" style={{ padding: '1.5rem', textAlign: 'center' }}>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Lecciones Programadas</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{stats.leccionesProgramadas}</div>
            </div>
            <div className="glass-card" style={{ padding: '1.5rem', textAlign: 'center' }}>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Ausencias Promedio</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--danger)' }}>{stats.ausenciasPromedio}</div>
            </div>
            <div className="glass-card" style={{ padding: '1.5rem', textAlign: 'center', borderLeft: '4px solid var(--primary)' }}>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Indice de Ausentismo</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{stats.porcentaje}%</div>
            </div>
        </div>
    );
}
