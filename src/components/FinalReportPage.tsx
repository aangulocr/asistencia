import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useToast } from './Toast';
import { Database } from '../types/database';
import { SupabaseClient } from '@supabase/supabase-js';
import { useEvaluationWeights, calculateAttendanceGradeFromAbsenteeism } from '../lib/evalConfig';

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
    // Semestral detail
    cotidiano: string;
    tareas: string;
    examenes: string;
    asistencia: string;
    total: string;
    // Acta Anual fields
    notaPeriodo1: number;
    notaPeriodo2: number;
    promedio: number;
    condicion: 'Aprobado' | 'Aplazado';
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
    const weights = useEvaluationWeights();
    const [secciones, setSecciones] = useState<Seccion[]>([]);
    const [selectedSeccion, setSelectedSeccion] = useState<string>('');
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(false);
    const [viewMode, setViewMode] = useState<'annual' | 'semester'>('annual');
    const [reportData, setReportData] = useState<ConsolidatedStudent[]>([]);
    const [isEditMode, setIsEditMode] = useState(false);
    const [manualOverrides, setManualOverrides] = useState<Record<string, { p1?: number; p2?: number }>>({});
    const { showToast } = useToast();

    // Load initial sections
    useEffect(() => {
        fetchInitialData();
    }, []);

    // Load overrides whenever selected section changes
    useEffect(() => {
        if (selectedSeccion) {
            try {
                const saved = localStorage.getItem(`acta_overrides_${selectedSeccion}`);
                if (saved) {
                    setManualOverrides(JSON.parse(saved));
                } else {
                    setManualOverrides({});
                }
            } catch (e) {
                console.error('Error loading overrides:', e);
            }
            fetchReportData(selectedSeccion);
        }
    }, [selectedSeccion, periodo, viewMode, weights]);

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

            // 2. Fetch all evaluation components for both periods to compute both semester and annual acta
            const periodsToFetch = [1, 2];

            // 3. Fetch all evaluation components
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

            // Fetch Direct Notes
            const { data: directTCData } = await (typedSupabase as any).from('notas_directas_cotidiano').select('*').in('trabajo_id', tcIds);
            const { data: directTarData } = await (typedSupabase as any).from('notas_directas_tarea').select('*').in('tarea_id', tarIds);
            const { data: directExData } = await (typedSupabase as any).from('notas_directas_examen').select('*').in('examen_id', exIds);

            const configMap: Record<string, number> = {};
            (configData || []).forEach(c => { configMap[`${c.fecha}-${c.periodo}`] = c.lecciones_totales; });

            // 4. Calculate for each student
            const consolidated: ConsolidatedStudent[] = students.map((est: Estudiante) => {
                const getGradesForPeriod = (p: number) => {
                    const currentTCs = (tcData || []).filter(t => t.periodo === p);
                    const currentTCIds = currentTCs.map(t => t.id);

                    // Cotidiano (weights.cotidiano %)
                    let tcAverage = 0;
                    if (currentTCIds.length > 0) {
                        let sumOfPercentages = 0;
                        currentTCIds.forEach((tcId: number) => {
                            const directNote = (directTCData || []).find((dn: any) => dn.estudiante_id === est.cedula && dn.trabajo_id === tcId);
                            if (directNote) {
                                sumOfPercentages += Number(directNote.nota);
                            } else {
                                const tcIndsForThis = (tcIndData || []).filter((i: any) => i.trabajo_id === tcId).map((i: any) => i.id);
                                if (tcIndsForThis.length > 0) {
                                    const studentEvals = (tcEvalData || []).filter((ev: any) => ev.estudiante_id === est.cedula && tcIndsForThis.includes(ev.indicador_id));
                                    const points = studentEvals.reduce((acc: number, curr: any) => acc + (curr.puntaje || 0), 0);
                                    const max = tcIndsForThis.length * 3;
                                    sumOfPercentages += (points / max) * 100;
                                }
                            }
                        });
                        tcAverage = (sumOfPercentages / currentTCIds.length) || 0;
                    }
                    const tcObtained = (tcAverage / 100) * weights.cotidiano;

                    // Tareas (promedio de tareas * weights.tareas)
                    let tarAverage = 0;
                    const currentTareas = (tarData || []).filter((t: any) => t.periodo === p);
                    if (currentTareas.length > 0) {
                        let sumOfPercentages = 0;
                        currentTareas.forEach((tar: any) => {
                            const directNote = (directTarData || []).find((dn: any) => dn.estudiante_id === est.cedula && dn.tarea_id === tar.id);
                            if (directNote) {
                                sumOfPercentages += Number(directNote.nota);
                            } else {
                                const inds = (tarIndData || []).filter((i: any) => i.tarea_id === tar.id).map((i: any) => i.id);
                                const evals = (tarEvalData || []).filter((ev: any) => ev.estudiante_id === est.cedula && inds.includes(ev.indicador_id));
                                const points = evals.reduce((acc: number, curr: any) => acc + (curr.puntaje || 0), 0);
                                const nota = tar.puntos_totales > 0 ? Math.round((points / tar.puntos_totales) * 100) : 0;
                                sumOfPercentages += nota;
                            }
                        });
                        tarAverage = (sumOfPercentages / currentTareas.length) || 0;
                    }
                    const tarObtained = (tarAverage / 100) * weights.tareas;

                    // Examenes (weights.examenes % máximo validado por prueba)
                    let exObtained = 0;
                    const currentExams = (exData || []).filter((e: any) => e.periodo === p);
                    if (currentExams.length > 0) {
                        currentExams.forEach((ex: any) => {
                            const directNote = (directExData || []).find((dn: any) => dn.estudiante_id === est.cedula && dn.examen_id === ex.id);
                            if (directNote) {
                                exObtained += (Number(directNote.nota) / 100) * ex.porcentaje;
                            } else {
                                const inds = (exIndData || []).filter((i: any) => i.examen_id === ex.id).map((i: any) => i.id);
                                const evals = (exEvalData || []).filter((ev: any) => ev.estudiante_id === est.cedula && inds.includes(ev.indicador_id));
                                const points = evals.reduce((acc: number, curr: any) => acc + (curr.puntaje || 0), 0);
                                exObtained += (points / ex.puntos_totales) * ex.porcentaje;
                            }
                        });
                    }

                    // Asistencia (weights.asistencia %)
                    const studentAtt = (attData || []).filter((a: any) => a.estudiante_id === est.cedula && a.periodo === p);
                    const currentConfigs = (configData || []).filter((c: any) => c.periodo === p);
                    const uniqueDatesForPeriod = Array.from(new Set(currentConfigs.map((c: any) => c.fecha)));
                    let totalProgrammedLessonsForPeriod = 0;
                    uniqueDatesForPeriod.forEach((d: any) => { totalProgrammedLessonsForPeriod += configMap[`${d}-${p}`] ?? 4; });

                    let totalWeight = 0;
                    studentAtt.forEach((att: any) => {
                        if (!att.estados_asistencia?.es_justificada) {
                            const lessonsToday = configMap[`${att.fecha}-${p}`] ?? 4;
                            let weight = att.estados_asistencia?.peso_ausencia || 0;
                            if (lessonsToday < 4 && weight > 0) {
                                weight = (weight / 4) * lessonsToday;
                            }
                            totalWeight += weight;
                        }
                    });
                    const flooredAbsences = Math.floor(totalWeight);
                    const absenteeismPercentage = totalProgrammedLessonsForPeriod > 0 ? (flooredAbsences / totalProgrammedLessonsForPeriod) * 100 : 0;
                    const attObtained = calculateAttendanceGradeFromAbsenteeism(absenteeismPercentage, weights.asistencia);

                    return { tcObtained, tarObtained, exObtained, attObtained, total: tcObtained + tarObtained + exObtained + attObtained };
                };

                const g1 = getGradesForPeriod(1);
                const g2 = getGradesForPeriod(2);

                const override = manualOverrides[est.cedula];
                const p1 = override?.p1 !== undefined ? override.p1 : Math.round(g1.total);
                const p2 = override?.p2 !== undefined ? override.p2 : Math.round(g2.total);

                const promedio = Math.round((p1 + p2) / 2);
                const condicion: 'Aprobado' | 'Aplazado' = promedio >= 70 ? 'Aprobado' : 'Aplazado';

                const gActive = getGradesForPeriod(periodo);

                return {
                    cedula: est.cedula,
                    nombreCompleto: `${est.apellidos || ''} ${est.nombre || ''}`.trim().toUpperCase(),
                    cotidiano: gActive.tcObtained.toFixed(2),
                    tareas: gActive.tarObtained.toFixed(2),
                    examenes: gActive.exObtained.toFixed(2),
                    asistencia: gActive.attObtained.toFixed(2),
                    total: gActive.total.toFixed(2),
                    notaPeriodo1: p1,
                    notaPeriodo2: p2,
                    promedio,
                    condicion
                };
            });

            setReportData(consolidated);
        } catch (error: any) {
            console.error('Error fetching report data:', error);
            showToast(`Error: ${error.message}`, 'error');
        } finally {
            setLoading(false);
        }
    }

    const handleUpdateNote = (cedula: string, field: 'p1' | 'p2', value: string) => {
        const numVal = value === '' ? 0 : Math.min(100, Math.max(0, Number(value) || 0));
        const updated = {
            ...manualOverrides,
            [cedula]: {
                ...manualOverrides[cedula],
                [field]: numVal
            }
        };
        setManualOverrides(updated);
        try {
            localStorage.setItem(`acta_overrides_${selectedSeccion}`, JSON.stringify(updated));
        } catch (e) {
            console.error('Error saving overrides:', e);
        }

        // Update in-memory reportData immediately for instant feedback
        setReportData(prev => prev.map(row => {
            if (row.cedula !== cedula) return row;
            const p1 = field === 'p1' ? numVal : row.notaPeriodo1;
            const p2 = field === 'p2' ? numVal : row.notaPeriodo2;
            const promedio = Math.round((p1 + p2) / 2);
            return {
                ...row,
                notaPeriodo1: p1,
                notaPeriodo2: p2,
                promedio,
                condicion: promedio >= 70 ? 'Aprobado' : 'Aplazado'
            };
        }));
    };

    const handleResetOverrides = () => {
        if (window.confirm('¿Deseas restablecer las notas a los cálculos automáticos del sistema?')) {
            setManualOverrides({});
            localStorage.removeItem(`acta_overrides_${selectedSeccion}`);
            fetchReportData(selectedSeccion);
            showToast('Notas restablecidas al cálculo automático', 'success');
        }
    };

    const downloadCSV = () => {
        if (reportData.length === 0) return;
        const seccionNombre = secciones.find(s => s.id === selectedSeccion)?.nombre || 'Seccion';

        if (viewMode === 'annual') {
            const headers = ['Identificación', 'Estudiante', 'Nota período 1', 'Nota período 2', 'Promedio', 'Condición'];
            const csvContent = [
                headers.join(','),
                ...filteredData.map(row => [
                    row.cedula,
                    `"${row.nombreCompleto}"`,
                    row.notaPeriodo1,
                    row.notaPeriodo2,
                    row.promedio,
                    row.condicion
                ].join(','))
            ].join('\n');

            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', `Acta_Anual_${seccionNombre}.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } else {
            const headers = [
                'CÉDULA',
                'NOMBRE COMPLETO',
                `COTIDIANO (${weights.cotidiano}%)`,
                `TAREAS (${weights.tareas}%)`,
                `EXÁMENES (${weights.examenes}%)`,
                `ASISTENCIA (${weights.asistencia}%)`,
                'TOTAL (100%)'
            ];
            const csvContent = [
                headers.join(','),
                ...filteredData.map(row => [
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
            link.setAttribute('download', `Reporte_Semestral_${seccionNombre}_Periodo_${periodo}.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    };

    const handlePrint = () => { window.print(); };

    const filteredData = reportData.filter(row =>
        row.nombreCompleto.toLowerCase().includes(searchQuery.toLowerCase()) ||
        row.cedula.includes(searchQuery)
    );

    // Group Statistics for Acta Anual
    const totalEstudiantes = filteredData.length;
    const aprobadosCount = filteredData.filter(r => r.condicion === 'Aprobado').length;
    const aplazadosCount = filteredData.filter(r => r.condicion === 'Aplazado').length;
    const aprobadosPct = totalEstudiantes > 0 ? Math.round((aprobadosCount / totalEstudiantes) * 100) : 0;
    const aplazadosPct = totalEstudiantes > 0 ? Math.round((aplazadosCount / totalEstudiantes) * 100) : 0;
    const promedioGeneral = totalEstudiantes > 0 ? Math.round(filteredData.reduce((acc, curr) => acc + curr.promedio, 0) / totalEstudiantes) : 0;

    const seccionActiva = secciones.find(s => s.id === selectedSeccion);

    return (
        <div className="report-page">
            {/* Action Bar Header */}
            <header style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }} className="no-print">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <div className="glass-card" style={{ display: 'flex', padding: '0.25rem', gap: '0.25rem' }}>
                        <button
                            onClick={() => setViewMode('annual')}
                            style={{
                                padding: '0.6rem 1.2rem',
                                borderRadius: '8px',
                                background: viewMode === 'annual' ? '#0056b3' : 'transparent',
                                border: 'none',
                                color: 'white',
                                cursor: 'pointer',
                                fontSize: '0.9rem',
                                fontWeight: viewMode === 'annual' ? 700 : 500,
                                minHeight: '44px',
                                transition: 'all 0.2s ease'
                            }}
                        >
                            📋 Acta Anual
                        </button>
                        <button
                            onClick={() => setViewMode('semester')}
                            style={{
                                padding: '0.6rem 1.2rem',
                                borderRadius: '8px',
                                background: viewMode === 'semester' ? '#0056b3' : 'transparent',
                                border: 'none',
                                color: 'white',
                                cursor: 'pointer',
                                fontSize: '0.9rem',
                                fontWeight: viewMode === 'semester' ? 700 : 500,
                                minHeight: '44px',
                                transition: 'all 0.2s ease'
                            }}
                        >
                            📊 Desglose Semestral
                        </button>
                    </div>

                    <select
                        value={selectedSeccion}
                        onChange={e => setSelectedSeccion(e.target.value)}
                        className="glass-card"
                        style={{
                            padding: '0.6rem 1rem',
                            background: 'rgba(255,255,255,0.05)',
                            color: 'white',
                            border: '1px solid var(--glass-border)',
                            borderRadius: '8px',
                            minHeight: '44px',
                            fontWeight: 600
                        }}
                    >
                        {secciones.map(s => <option key={s.id} value={s.id} style={{ background: '#1e1b4b' }}>Sección {s.nombre}</option>)}
                    </select>

                    {viewMode === 'annual' && (
                        <button
                            onClick={() => setIsEditMode(!isEditMode)}
                            className="btn-primary"
                            style={{
                                background: isEditMode ? 'rgba(234, 179, 8, 0.2)' : 'rgba(255, 255, 255, 0.08)',
                                color: isEditMode ? '#facc15' : 'white',
                                border: isEditMode ? '1px solid #facc15' : '1px solid var(--glass-border)',
                                minHeight: '44px',
                                padding: '0.6rem 1rem'
                            }}
                            title="Permite ajustar manualmente las notas de los periodos"
                        >
                            {isEditMode ? '✏️ Modo Edición Activo' : '✏️ Ajustar Notas'}
                        </button>
                    )}

                    {isEditMode && Object.keys(manualOverrides).length > 0 && (
                        <button
                            onClick={handleResetOverrides}
                            className="btn-primary"
                            style={{
                                background: 'rgba(239, 68, 68, 0.15)',
                                color: '#f87171',
                                border: '1px solid rgba(239, 68, 68, 0.4)',
                                minHeight: '44px',
                                padding: '0.6rem 1rem'
                            }}
                        >
                            🔄 Restablecer Cálculos
                        </button>
                    )}
                </div>

                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                    <button
                        onClick={downloadCSV}
                        className="btn-primary"
                        style={{
                            background: 'rgba(34, 197, 94, 0.15)',
                            color: '#22c55e',
                            border: '1px solid #22c55e',
                            minHeight: '44px',
                            padding: '0.6rem 1.2rem',
                            fontWeight: 600
                        }}
                    >
                        📥 Exportar Excel (CSV)
                    </button>
                    <button
                        onClick={handlePrint}
                        className="btn-primary"
                        style={{
                            background: '#0056b3',
                            minHeight: '44px',
                            padding: '0.6rem 1.2rem',
                            fontWeight: 600
                        }}
                    >
                        🖨️ Imprimir PDF
                    </button>
                </div>
            </header>

            {/* Quick KPI Cards when in Acta Anual */}
            {viewMode === 'annual' && !loading && (
                <div className="grid no-print" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                    <div className="glass-card" style={{ padding: '1rem 1.25rem', textAlign: 'center' }}>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Estudiantes</div>
                        <div style={{ fontSize: '1.8rem', fontWeight: 800 }}>{totalEstudiantes}</div>
                    </div>
                    <div className="glass-card" style={{ padding: '1rem 1.25rem', textAlign: 'center', borderBottom: '3px solid #22c55e' }}>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Aprobados (≥ 70)</div>
                        <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#22c55e' }}>
                            {aprobadosCount} <span style={{ fontSize: '0.95rem', fontWeight: 500 }}>({aprobadosPct}%)</span>
                        </div>
                    </div>
                    <div className="glass-card" style={{ padding: '1rem 1.25rem', textAlign: 'center', borderBottom: '3px solid #ef4444' }}>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Aplazados (&lt; 70)</div>
                        <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#ef4444' }}>
                            {aplazadosCount} <span style={{ fontSize: '0.95rem', fontWeight: 500 }}>({aplazadosPct}%)</span>
                        </div>
                    </div>
                    <div className="glass-card" style={{ padding: '1rem 1.25rem', textAlign: 'center' }}>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Promedio General</div>
                        <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#38bdf8' }}>{promedioGeneral}</div>
                    </div>
                </div>
            )}

            {/* Search Box */}
            <div className="glass-card no-print" style={{ padding: '0.75rem 1rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '1.2rem', color: 'var(--text-muted)' }}>🔍</span>
                <input
                    type="text"
                    placeholder="Buscar por estudiante o identificación..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    style={{
                        width: '100%',
                        background: 'none',
                        border: 'none',
                        color: 'white',
                        fontSize: '1rem',
                        outline: 'none'
                    }}
                />
            </div>

            {/* Official Print Header */}
            <div className="only-print" style={{ display: 'none', textAlign: 'center', marginBottom: '2rem' }}>
                <h1 style={{ color: 'black', fontSize: '26pt', margin: '0 0 6px 0', fontWeight: 'bold', letterSpacing: '-0.5px' }}>
                    {viewMode === 'annual' ? 'Acta Anual' : `Reporte de Calificaciones - Semestre ${periodo}`}
                </h1>
                <h2 style={{ color: '#222', fontSize: '13pt', margin: '0 0 4px 0', fontWeight: 600 }}>
                    Ministerio de Educación Pública — Control Escolar 2026
                </h2>
                <p style={{ color: '#555', fontSize: '10.5pt', margin: '0 0 10px 0' }}>
                    Sección: <strong>{seccionActiva?.nombre || 'General'}</strong> &nbsp;|&nbsp; 
                    Fecha de Emisión: <strong>{new Date().toLocaleDateString('es-CR')}</strong>
                </p>
            </div>

            {/* Main Content Area */}
            <div className="glass-card" style={{ padding: '2rem 1.5rem', overflowX: 'auto' }}>
                {viewMode === 'annual' ? (
                    <div>
                        {/* Centered Title matching the user's reference image */}
                        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                            <h1 style={{ fontSize: '2.5rem', fontWeight: 700, margin: 0, letterSpacing: '-0.5px' }}>
                                Acta Anual
                            </h1>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', marginTop: '0.5rem' }}>
                                Sección {seccionActiva?.nombre || ''} — Ciclo Lectivo 2026
                            </p>
                        </div>

                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                            <thead>
                                <tr style={{ borderBottom: '2px solid var(--glass-border)', background: 'rgba(255,255,255,0.02)' }}>
                                    <th style={{ padding: '1rem 1.25rem', fontWeight: 600, color: 'var(--text-muted)', width: '18%' }}>Identificación</th>
                                    <th style={{ padding: '1rem 1.25rem', fontWeight: 600, color: 'var(--text-muted)', width: '36%' }}>Estudiante</th>
                                    <th style={{ padding: '1rem 1.25rem', fontWeight: 600, color: 'var(--text-muted)', textAlign: 'center', width: '12%' }}>Nota período 1</th>
                                    <th style={{ padding: '1rem 1.25rem', fontWeight: 600, color: 'var(--text-muted)', textAlign: 'center', width: '12%' }}>Nota período 2</th>
                                    <th style={{ padding: '1rem 1.25rem', fontWeight: 700, color: 'var(--text-muted)', textAlign: 'center', width: '11%' }}>Promedio</th>
                                    <th style={{ padding: '1rem 1.25rem', fontWeight: 600, color: 'var(--text-muted)', textAlign: 'center', width: '11%' }}>Condición</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr><td colSpan={6} style={{ textAlign: 'center', padding: '3rem' }}>Generando Acta Anual...</td></tr>
                                ) : filteredData.length === 0 ? (
                                    <tr><td colSpan={6} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>No se encontraron registros para esta sección.</td></tr>
                                ) : filteredData.map(row => (
                                    <tr key={row.cedula} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', transition: 'background 0.2s' }}>
                                        <td style={{ padding: '1rem 1.25rem', fontFamily: 'monospace', fontSize: '0.95rem' }}>
                                            {row.cedula}
                                        </td>
                                        <td style={{ padding: '1rem 1.25rem', fontWeight: 600, letterSpacing: '0.2px' }}>
                                            {row.nombreCompleto}
                                        </td>
                                        <td style={{ padding: '1rem 1.25rem', textAlign: 'center' }}>
                                            {isEditMode ? (
                                                <input
                                                    type="number"
                                                    min="0"
                                                    max="100"
                                                    value={row.notaPeriodo1}
                                                    onChange={e => handleUpdateNote(row.cedula, 'p1', e.target.value)}
                                                    style={{
                                                        width: '65px',
                                                        padding: '0.35rem',
                                                        textAlign: 'center',
                                                        borderRadius: '6px',
                                                        background: 'rgba(255,255,255,0.1)',
                                                        color: 'white',
                                                        border: '1px solid #0056b3',
                                                        fontSize: '1rem'
                                                    }}
                                                />
                                            ) : (
                                                <span style={{ fontSize: '1.05rem' }}>{row.notaPeriodo1}</span>
                                            )}
                                        </td>
                                        <td style={{ padding: '1rem 1.25rem', textAlign: 'center' }}>
                                            {isEditMode ? (
                                                <input
                                                    type="number"
                                                    min="0"
                                                    max="100"
                                                    value={row.notaPeriodo2}
                                                    onChange={e => handleUpdateNote(row.cedula, 'p2', e.target.value)}
                                                    style={{
                                                        width: '65px',
                                                        padding: '0.35rem',
                                                        textAlign: 'center',
                                                        borderRadius: '6px',
                                                        background: 'rgba(255,255,255,0.1)',
                                                        color: 'white',
                                                        border: '1px solid #0056b3',
                                                        fontSize: '1rem'
                                                    }}
                                                />
                                            ) : (
                                                <span style={{ fontSize: '1.05rem' }}>{row.notaPeriodo2}</span>
                                            )}
                                        </td>
                                        <td style={{
                                            padding: '1rem 1.25rem',
                                            textAlign: 'center',
                                            fontWeight: 800,
                                            fontSize: '1.15rem',
                                            color: row.promedio >= 70 ? '#38bdf8' : '#f87171'
                                        }}>
                                            {row.promedio}
                                        </td>
                                        <td style={{ padding: '1rem 1.25rem', textAlign: 'center' }}>
                                            <span style={{
                                                display: 'inline-block',
                                                padding: '0.35rem 0.85rem',
                                                borderRadius: '9999px',
                                                fontSize: '0.85rem',
                                                fontWeight: 700,
                                                backgroundColor: row.condicion === 'Aprobado' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                                                color: row.condicion === 'Aprobado' ? '#4ade80' : '#f87171',
                                                border: `1px solid ${row.condicion === 'Aprobado' ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`
                                            }}>
                                                {row.condicion}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div>
                        <div style={{ marginBottom: '1.5rem' }}>
                            <h2 style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>Desglose Académico Semestral - Semestre {periodo}</h2>
                            <p style={{ color: 'var(--text-muted)' }}>
                                Ponderación configurada: Cotidiano {weights.cotidiano}% | Tareas {weights.tareas}% | Exámenes {weights.examenes}% | Asistencia {weights.asistencia}%
                            </p>
                        </div>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ borderBottom: '2px solid var(--glass-border)', background: 'rgba(255,255,255,0.02)' }}>
                                    <th style={{ textAlign: 'left', padding: '1rem' }}>CÉDULA</th>
                                    <th style={{ textAlign: 'left', padding: '1rem' }}>NOMBRE COMPLETO</th>
                                    <th style={{ textAlign: 'center', padding: '1rem' }}>COTIDIANO ({weights.cotidiano}%)</th>
                                    <th style={{ textAlign: 'center', padding: '1rem' }}>TAREAS ({weights.tareas}%)</th>
                                    <th style={{ textAlign: 'center', padding: '1rem' }}>EXÁMENES ({weights.examenes}%)</th>
                                    <th style={{ textAlign: 'center', padding: '1rem' }}>ASISTENCIA ({weights.asistencia}%)</th>
                                    <th style={{ textAlign: 'center', padding: '1rem', color: '#0056b3', fontWeight: 800 }}>TOTAL (100%)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr><td colSpan={7} style={{ textAlign: 'center', padding: '3rem' }}>Generando desglose...</td></tr>
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
                                        <td style={{ textAlign: 'center', padding: '1rem', fontWeight: 800, color: Number(row.total) >= 70 ? '#38bdf8' : '#f87171', fontSize: '1.1rem' }}>
                                            {row.total}%
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Official Signature Area in Print Mode */}
            <div className="only-print" style={{ display: 'none', marginTop: '5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-around', padding: '0 2rem' }}>
                    <div style={{ textAlign: 'center', width: '250px' }}>
                        <div style={{ borderTop: '1px solid black', paddingTop: '8px', fontSize: '11pt', fontWeight: 'bold' }}>
                            Firma del Docente
                        </div>
                    </div>
                    <div style={{ textAlign: 'center', width: '250px' }}>
                        <div style={{ borderTop: '1px solid black', paddingTop: '8px', fontSize: '11pt', fontWeight: 'bold' }}>
                            Sello Dirección / Comité
                        </div>
                    </div>
                </div>
            </div>

            {/* Print Styling */}
            <style>{`
                @media print {
                    @page { size: landscape; margin: 12mm; }
                    html, body { 
                        height: auto !important; 
                        overflow: visible !important; 
                        background: white !important;
                        margin: 0 !important;
                        padding: 0 !important;
                    }
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
                        padding: 0 !important;
                    }
                    table { 
                        width: 100% !important; 
                        border-collapse: collapse !important; 
                        color: black !important;
                        table-layout: auto !important;
                        margin-top: 1.5rem !important;
                    }
                    th, td { 
                        border: 1px solid #222 !important; 
                        padding: 8px 12px !important; 
                        color: black !important; 
                        page-break-inside: avoid !important;
                    }
                    th { 
                        background: #f1f5f9 !important; 
                        font-weight: bold !important; 
                        color: black !important;
                    }
                    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
                }
            `}</style>
        </div>
    );
};
