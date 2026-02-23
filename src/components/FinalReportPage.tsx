import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useToast } from './Toast';
import { Database } from '../types/database';
import { SupabaseClient } from '@supabase/supabase-js';

const typedSupabase = supabase as SupabaseClient<Database>;

type Seccion = Database['public']['Tables']['secciones']['Row'];
type Estudiante = Database['public']['Tables']['estudiantes']['Row'];
type TrabajoCotidiano = Database['public']['Tables']['trabajos_cotidianos']['Row'];
type IndicadorCotidiano = Database['public']['Tables']['indicadores']['Row'];
type Tarea = Database['public']['Tables']['tareas']['Row'];
type IndicadorTarea = Database['public']['Tables']['indicadores_tarea']['Row'];
type Examen = Database['public']['Tables']['examenes']['Row'];
type IndicadorExamen = Database['public']['Tables']['indicadores_examen']['Row'];
type ConfiguracionDiaria = Database['public']['Tables']['configuracion_diaria']['Row'];
type EvaluacionCotidiano = Database['public']['Tables']['evaluaciones_cotidiano']['Row'];
type EvaluacionTarea = Database['public']['Tables']['evaluaciones_tarea']['Row'];
type EvaluacionExamen = Database['public']['Tables']['evaluaciones_examen']['Row'];

interface ConsolidatedStudent {
    cedula: string;
    nombreCompleto: string;
    cotidiano: string;
    tareas: string;
    examenes: string;
    asistencia: string;
    total: string;
}

interface AttRowJoined {
    estudiante_id: string;
    fecha: string;
    periodo: number;
    estado_id: number;
    estados_asistencia: { peso_ausencia: number, es_justificada: boolean } | null;
}

interface Props {
    periodo: number;
}

export const FinalReportPage: React.FC<Props> = ({ periodo }) => {
    const [secciones, setSecciones] = useState<Seccion[]>([]);
    const [selectedSeccion, setSelectedSeccion] = useState<string>('');
    const [estudiantes, setEstudiantes] = useState<Estudiante[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(false);
    const [viewMode, setViewMode] = useState<'semester' | 'annual'>('semester');
    const [reportData, setReportData] = useState<ConsolidatedStudent[]>([]);
    const { showToast } = useToast();

    useEffect(() => {
        fetchInitialData();
    }, []);

    useEffect(() => {
        if (selectedSeccion) {
            fetchReportData(selectedSeccion);
        }
    }, [selectedSeccion, periodo, viewMode]);

    async function fetchInitialData() {
        const { data } = await typedSupabase.from('secciones').select('*').order('nombre') as { data: Seccion[] | null };
        setSecciones(data || []);
        if (data && data.length > 0) setSelectedSeccion(data[0].id);
    }

    async function fetchReportData(seccionId: string) {
        setLoading(true);
        try {
            // 1. Get Students
            const { data: estData } = await typedSupabase.from('estudiantes').select('*').eq('seccion_id', seccionId).order('apellidos');
            const students: Estudiante[] = estData || [];

            // 2. Determine periods to fetch
            const periodsToFetch = viewMode === 'semester' ? [periodo] : [1, 2];

            // 3. Fetch all evaluation components for required periods
            const { data: tcData } = await typedSupabase.from('trabajos_cotidianos').select('*').eq('seccion_id', seccionId).in('periodo', periodsToFetch) as { data: TrabajoCotidiano[] | null };
            const { data: tarData } = await typedSupabase.from('tareas').select('*').eq('seccion_id', seccionId).in('periodo', periodsToFetch) as { data: Tarea[] | null };
            const { data: exData } = await typedSupabase.from('examenes').select('*').eq('seccion_id', seccionId).in('periodo', periodsToFetch) as { data: Examen[] | null };
            const { data: attData } = await typedSupabase.from('control_asistencia').select('estudiante_id, fecha, periodo, estado_id, estados_asistencia(peso_ausencia, es_justificada)').eq('seccion_id', seccionId).in('periodo', periodsToFetch) as { data: AttRowJoined[] | null };
            const { data: configData } = await typedSupabase.from('configuracion_diaria').select('fecha, periodo, lecciones_totales').eq('seccion_id', seccionId).in('periodo', periodsToFetch) as { data: ConfiguracionDiaria[] | null };

            // Additional data for cotidiano
            const tcIds = (tcData || []).map(t => t.id);
            const { data: tcIndData } = await typedSupabase.from('indicadores').select('id, trabajo_id').in('trabajo_id', tcIds) as { data: IndicadorCotidiano[] | null };
            const tcIndIds = (tcIndData || []).map(i => i.id);
            const { data: tcEvalData } = await typedSupabase.from('evaluaciones_cotidiano').select('*').in('indicador_id', tcIndIds) as { data: EvaluacionCotidiano[] | null };

            // Additional data for tasks/exams
            const tarIds = (tarData || []).map(t => t.id);
            const { data: tarIndData } = await typedSupabase.from('indicadores_tarea').select('id, tarea_id').in('tarea_id', tarIds) as { data: IndicadorTarea[] | null };
            const tarIndIds = (tarIndData || []).map(i => i.id);
            const { data: tarEvalData } = await typedSupabase.from('evaluaciones_tarea').select('*').in('indicador_id', tarIndIds) as { data: EvaluacionTarea[] | null };

            const exIds = (exData || []).map(e => e.id);
            const { data: exIndData } = await typedSupabase.from('indicadores_examen').select('id, examen_id').in('examen_id', exIds) as { data: IndicadorExamen[] | null };
            const exIndIds = (exIndData || []).map(i => i.id);
            const { data: exEvalData } = await typedSupabase.from('evaluaciones_examen').select('*').in('indicador_id', exIndIds) as { data: EvaluacionExamen[] | null };

            const configMap: Record<string, number> = {};
            (configData || []).forEach(c => { configMap[`${c.fecha}-${c.periodo}`] = c.lecciones_totales; });

            // 4. Group data by student and calculate
            const consolidated = students.map((est: Estudiante) => {
                const getGradesForPeriod = (p: number) => {
                    const currentTCs = (tcData || []).filter(t => t.periodo === p);
                    const currentTCIds = currentTCs.map(t => t.id);

                    // Cotidiano (35%)
                    let tcAverage = 0;
                    if (currentTCIds.length > 0) {
                        let sumOfPercentages = 0;
                        currentTCIds.forEach((tcId: number) => {
                            const tcIndsForThis = (tcIndData || []).filter((i: any) => i.trabajo_id === tcId).map((i: any) => i.id);
                            if (tcIndsForThis.length > 0) {
                                const studentEvals = (tcEvalData || []).filter((ev: any) => ev.estudiante_id === est.cedula && tcIndsForThis.includes(ev.indicador_id));
                                const points = studentEvals.reduce((acc: number, curr: any) => acc + (curr.puntaje || 0), 0);
                                const max = tcIndsForThis.length * 3;
                                sumOfPercentages += (points / max) * 100;
                            }
                        });
                        tcAverage = (sumOfPercentages / currentTCIds.length) || 0;
                    }
                    const tcObtained = (tcAverage / 100) * 35;

                    // Tareas (10%)
                    let tarObtained = 0;
                    const currentTareas = (tarData || []).filter((t: any) => t.periodo === p);
                    if (currentTareas.length > 0) {
                        currentTareas.forEach((tar: any) => {
                            const inds = (tarIndData || []).filter((i: any) => i.tarea_id === tar.id).map((i: any) => i.id);
                            const evals = (tarEvalData || []).filter((ev: any) => ev.estudiante_id === est.cedula && inds.includes(ev.indicador_id));
                            const points = evals.reduce((acc: number, curr: any) => acc + (curr.puntaje || 0), 0);
                            tarObtained += (points / tar.puntos_totales) * tar.porcentaje;
                        });
                    }

                    // Examenes (50%)
                    let exObtained = 0;
                    const currentExams = (exData || []).filter((e: any) => e.periodo === p);
                    if (currentExams.length > 0) {
                        currentExams.forEach((ex: any) => {
                            const inds = (exIndData || []).filter((i: any) => i.examen_id === ex.id).map((i: any) => i.id);
                            const evals = (exEvalData || []).filter((ev: any) => ev.estudiante_id === est.cedula && inds.includes(ev.indicador_id));
                            const points = evals.reduce((acc: number, curr: any) => acc + (curr.puntaje || 0), 0);
                            exObtained += (points / ex.puntos_totales) * ex.porcentaje;
                        });
                    }

                    // Asistencia (5%)
                    const studentAtt = (attData || []).filter((a: any) => a.estudiante_id === est.cedula && a.periodo === p);
                    const currentConfigs = (configData || []).filter((c: any) => c.periodo === p);
                    const uniqueDatesForPeriod = Array.from(new Set(currentConfigs.map((c: any) => c.fecha)));
                    let totalProgrammedLessonsForPeriod = 0;
                    uniqueDatesForPeriod.forEach((d: any) => { totalProgrammedLessonsForPeriod += configMap[`${d}-${p}`] || 4; });

                    let totalWeight = 0;
                    studentAtt.forEach((att: any) => {
                        if (!att.estados_asistencia?.es_justificada) {
                            const lessonsToday = configMap[`${att.fecha}-${p}`] || 4;
                            let weight = att.estados_asistencia?.peso_ausencia || 0;
                            if (lessonsToday < 4 && weight > 0) {
                                weight = (weight / 4) * lessonsToday;
                            }
                            totalWeight += weight;
                        }
                    });
                    const flooredAbsences = Math.floor(totalWeight);
                    const absenteeismPercentage = totalProgrammedLessonsForPeriod > 0 ? (flooredAbsences / totalProgrammedLessonsForPeriod) * 100 : 0;
                    let attObtained = 0;
                    if (absenteeismPercentage < 10) attObtained = 5;
                    else if (absenteeismPercentage < 20) attObtained = 4;
                    else if (absenteeismPercentage < 30) attObtained = 3;
                    else if (absenteeismPercentage < 40) attObtained = 2;
                    else if (absenteeismPercentage < 50) attObtained = 1;
                    else attObtained = 0;

                    return { tcObtained, tarObtained, exObtained, attObtained, total: tcObtained + tarObtained + exObtained + attObtained };
                };

                if (viewMode === 'semester') {
                    const g = getGradesForPeriod(periodo);
                    return {
                        cedula: est.cedula,
                        nombreCompleto: `${est.apellidos} ${est.nombre}`,
                        cotidiano: g.tcObtained.toFixed(2),
                        tareas: g.tarObtained.toFixed(2),
                        examenes: g.exObtained.toFixed(2),
                        asistencia: g.attObtained.toFixed(2),
                        total: g.total.toFixed(2)
                    };
                } else {
                    const g1 = getGradesForPeriod(1);
                    const g2 = getGradesForPeriod(2);
                    const annualTotal = (g1.total + g2.total) / 2;
                    return {
                        cedula: est.cedula,
                        nombreCompleto: `${est.apellidos} ${est.nombre}`,
                        cotidiano: ((g1.tcObtained + g2.tcObtained) / 2).toFixed(2),
                        tareas: ((g1.tarObtained + g2.tarObtained) / 2).toFixed(2),
                        examenes: ((g1.exObtained + g2.exObtained) / 2).toFixed(2),
                        asistencia: ((g1.attObtained + g2.attObtained) / 2).toFixed(2),
                        total: annualTotal.toFixed(2)
                    };
                }
            });

            setReportData(consolidated);
        } catch (error: any) {
            console.error('Error fetching report data:', error);
            showToast(`Error: ${error.message}`, 'error');
        } finally {
            setLoading(false);
        }
    }

    const downloadCSV = () => {
        if (reportData.length === 0) return;
        const headers = ['CEDULA', 'NOMBRE COMPLETO', 'COTIDIANO', 'TAREAS', 'EXAMENES', 'ASISTENCIA', 'TOTAL'];
        const csvContent = [
            headers.join(','),
            ...reportData.map(row => [
                row.cedula,
                `"${row.nombreCompleto}"`,
                row.cotidiano,
                row.tareas,
                row.examenes,
                row.asistencia,
                row.total
            ].join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `Reporte_Final_${secciones.find(s => s.id === selectedSeccion)?.nombre || 'Seccion'}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handlePrint = () => { window.print(); };

    const filteredData = reportData.filter(row =>
        row.nombreCompleto.toLowerCase().includes(searchQuery.toLowerCase()) ||
        row.cedula.includes(searchQuery)
    );

    return (
        <div className="report-page">
            <header style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <div>
                    <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>
                        {viewMode === 'semester' ? `Reporte Final de Notas - Semestre ${periodo}` : 'Reporte Consolidado Anual'}
                    </h1>
                    <p style={{ color: 'var(--text-muted)' }}>
                        {viewMode === 'semester' ? 'Consolidado académico semestral (Base 100%).' : 'Promedio ponderado de ambos semestres (50% cada uno).'}
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }} className="no-print">
                    <div className="glass-card" style={{ display: 'flex', padding: '0.25rem', gap: '0.25rem' }}>
                        <button
                            onClick={() => setViewMode('semester')}
                            style={{
                                padding: '0.5rem 1rem',
                                borderRadius: '6px',
                                background: viewMode === 'semester' ? 'var(--primary)' : 'transparent',
                                border: 'none',
                                color: 'white',
                                cursor: 'pointer',
                                fontSize: '0.9rem'
                            }}
                        >
                            Vista Semestral
                        </button>
                        <button
                            onClick={() => setViewMode('annual')}
                            style={{
                                padding: '0.5rem 1rem',
                                borderRadius: '6px',
                                background: viewMode === 'annual' ? 'var(--primary)' : 'transparent',
                                border: 'none',
                                color: 'white',
                                cursor: 'pointer',
                                fontSize: '0.9rem'
                            }}
                        >
                            Vista Anual
                        </button>
                    </div>
                    <select
                        value={selectedSeccion}
                        onChange={e => setSelectedSeccion(e.target.value)}
                        className="glass-card"
                        style={{ padding: '0.75rem 1rem', background: 'rgba(255,255,255,0.05)', color: 'white', border: 'none' }}
                    >
                        {secciones.map(s => <option key={s.id} value={s.id} style={{ background: '#1e1b4b' }}>{s.nombre}</option>)}
                    </select>
                    <button onClick={downloadCSV} className="btn-primary" style={{ background: 'rgba(34, 197, 94, 0.1)', color: '#22c55e', border: '1px solid #22c55e' }}>
                        📥 Exportar Excel (CSV)
                    </button>
                    <button onClick={handlePrint} className="btn-primary">
                        🖨️ Imprimir PDF
                    </button>
                </div>
            </header>

            <div className="glass-card no-print" style={{ padding: '1rem', marginBottom: '1.5rem' }}>
                <input
                    type="text"
                    placeholder="Buscar por nombre o cédula..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    style={{
                        width: '100%',
                        background: 'none',
                        border: 'none',
                        color: 'white',
                        fontSize: '1rem',
                        padding: '0.5rem'
                    }}
                />
            </div>

            <div className="only-print" style={{ display: 'none', textAlign: 'center', marginBottom: '2rem' }}>
                <h1 style={{ color: 'black' }}>Reporte Final de Calificaciones - MEP 2026</h1>
                <h2 style={{ color: 'black' }}>Sección: {secciones.find(s => s.id === selectedSeccion)?.nombre}</h2>
                <p style={{ color: 'black' }}>Fecha: {new Date().toLocaleDateString()}</p>
            </div>

            <div className="glass-card" style={{ padding: '0', overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ borderBottom: '2px solid var(--glass-border)', background: 'rgba(255,255,255,0.02)' }}>
                            <th style={{ textAlign: 'left', padding: '1rem' }}>CÉDULA</th>
                            <th style={{ textAlign: 'left', padding: '1rem' }}>NOMBRE COMPLETO</th>
                            <th style={{ textAlign: 'center', padding: '1rem' }}>COTIDIANO (35%)</th>
                            <th style={{ textAlign: 'center', padding: '1rem' }}>TAREAS (10%)</th>
                            <th style={{ textAlign: 'center', padding: '1rem' }}>EXÁMENES (50%)</th>
                            <th style={{ textAlign: 'center', padding: '1rem' }}>ASISTENCIA (5%)</th>
                            <th style={{ textAlign: 'center', padding: '1rem', color: 'var(--primary)', fontWeight: 800 }}>TOTAL (100%)</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={7} style={{ textAlign: 'center', padding: '3rem' }}>Generando consolidado...</td></tr>
                        ) : filteredData.length === 0 ? (
                            <tr><td colSpan={7} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>No se encontraron registros.</td></tr>
                        ) : filteredData.map(row => (
                            <tr key={row.cedula} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                <td style={{ padding: '1rem' }}>{row.cedula}</td>
                                <td style={{ padding: '1rem', fontWeight: 600 }}>{row.nombreCompleto}</td>
                                <td style={{ textAlign: 'center', padding: '1rem' }}>{row.cotidiano}%</td>
                                <td style={{ textAlign: 'center', padding: '1rem' }}>{row.tareas}%</td>
                                <td style={{ textAlign: 'center', padding: '1rem' }}>{row.examenes}%</td>
                                <td style={{ textAlign: 'center', padding: '1rem' }}>{row.asistencia}%</td>
                                <td style={{ textAlign: 'center', padding: '1rem', fontWeight: 800, color: Number(row.total) >= 70 ? 'var(--primary)' : 'var(--danger)', fontSize: '1.1rem' }}>
                                    {row.total}%
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <style>{`
                @media print {
                    @page { size: landscape; margin: 10mm; }
                    html, body { 
                        height: auto !important; 
                        overflow: visible !important; 
                        background: white !important;
                        margin: 0 !important;
                        padding: 0 !important;
                    }
                    /* Reset layout for print */
                    .app-layout { display: block !important; }
                    .sidebar { display: none !important; }
                    .container { 
                        padding: 0 !important; 
                        margin: 0 !important; 
                        max-width: none !important; 
                        width: 100% !important; 
                    }
                    
                    .no-print { display: none !important; }
                    .only-print { display: block !important; }
                    
                    .report-page { 
                        position: static !important; 
                        width: 100% !important; 
                        padding: 0 !important; 
                        background: white !important; 
                        display: block !important;
                        overflow: visible !important;
                    }
                    .glass-card { 
                        background: white !important; 
                        border: none !important; 
                        color: black !important; 
                        box-shadow: none !important; 
                        overflow: visible !important;
                        display: block !important;
                        backdrop-filter: none !important;
                        -webkit-backdrop-filter: none !important;
                    }
                    table { 
                        width: 100% !important; 
                        border-collapse: collapse !important; 
                        color: black !important;
                        table-layout: auto !important;
                    }
                    th, td { 
                        border: 1px solid black !important; 
                        padding: 8px !important; 
                        color: black !important;
                        page-break-inside: avoid !important;
                    }
                    th { background: #f0f0f0 !important; }
                    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
                }
            `}</style>
        </div>
    );
};
