import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useToast } from './Toast';
import { Database } from '../types/database';

type Seccion = Database['public']['Tables']['secciones']['Row'];
type Estudiante = Database['public']['Tables']['estudiantes']['Row'];

interface ConsolidatedStudent {
    cedula: string;
    nombreCompleto: string;
    cotidiano: string;
    tareas: string;
    examenes: string;
    asistencia: string;
    total: string;
}

type TCId = { id: number };
type TCIng = { id: string, trabajo_id: number };
type Eval = Database['public']['Tables']['evaluaciones_cotidiano']['Row'];
type TareaRow = Database['public']['Tables']['tareas']['Row'];
type TareaInd = Database['public']['Tables']['indicadores_tarea']['Row'];
type ExamenRow = Database['public']['Tables']['examenes']['Row'];
type ExamenInd = Database['public']['Tables']['indicadores_examen']['Row'];
type ConfigRow = Database['public']['Tables']['configuracion_diaria']['Row'];
type AttRow = {
    estudiante_id: string;
    fecha: string;
    estado_id: number;
    estados_asistencia: { peso_ausencia: number, es_justificada: boolean }
};

export const FinalReportPage: React.FC = () => {
    const [secciones, setSecciones] = useState<Seccion[]>([]);
    const [selectedSeccion, setSelectedSeccion] = useState<string>('');
    const [estudiantes, setEstudiantes] = useState<Estudiante[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(false);
    const [reportData, setReportData] = useState<ConsolidatedStudent[]>([]);
    const { showToast } = useToast();

    useEffect(() => {
        fetchInitialData();
    }, []);

    useEffect(() => {
        if (selectedSeccion) {
            fetchReportData(selectedSeccion);
        }
    }, [selectedSeccion]);

    async function fetchInitialData() {
        const { data } = await supabase.from('secciones').select('*').order('nombre') as { data: Seccion[] | null };
        setSecciones(data || []);
        if (data && data.length > 0) setSelectedSeccion(data[0].id);
    }

    async function fetchReportData(seccionId: string) {
        setLoading(true);
        try {
            // 1. Get Students
            const { data: estData } = await supabase.from('estudiantes').select('*').eq('seccion_id', seccionId).order('apellidos') as { data: Estudiante[] | null };
            const students = estData || [];

            // 2. Get All Evaluations
            // 2.1 Cotidiano
            const { data: tcData } = await supabase.from('trabajos_cotidianos').select('id').eq('seccion_id', seccionId) as { data: { id: number }[] | null };
            const tcIds = (tcData || []).map(t => t.id);
            const { data: tcIndData } = await supabase.from('indicadores').select('id, trabajo_id').in('trabajo_id', tcIds) as { data: any[] | null };
            const tcIndIds = (tcIndData || []).map(i => i.id);
            const { data: tcEvalData } = await supabase.from('evaluaciones_cotidiano').select('*').in('indicador_id', tcIndIds) as { data: any[] | null };

            // 2.2 Tareas
            const { data: tarData } = await supabase.from('tareas').select('*').eq('seccion_id', seccionId) as { data: any[] | null };
            const tarIds = (tarData || []).map(t => t.id);
            const { data: tarIndData } = await supabase.from('indicadores_tarea').select('id, tarea_id').in('tarea_id', tarIds) as { data: any[] | null };
            const tarIndIds = (tarIndData || []).map(i => i.id);
            const { data: tarEvalData } = await supabase.from('evaluaciones_tarea').select('*').in('indicador_id', tarIndIds) as { data: any[] | null };

            // 2.3 Examenes
            const { data: exData } = await supabase.from('examenes').select('*').eq('seccion_id', seccionId) as { data: any[] | null };
            const exIds = (exData || []).map(e => e.id);
            const { data: exIndData } = await supabase.from('indicadores_examen').select('id, examen_id').in('examen_id', exIds) as { data: any[] | null };
            const exIndIds = (exIndData || []).map(i => i.id);
            const { data: exEvalData } = await supabase.from('evaluaciones_examen').select('*').in('indicador_id', exIndIds) as { data: any[] | null };

            // 2.4 Asistencia
            const { data: attData } = await supabase.from('control_asistencia').select('estudiante_id, fecha, estado_id, estados_asistencia(peso_ausencia, es_justificada)').eq('seccion_id', seccionId) as { data: AttRow[] | null };
            const { data: configData } = await supabase.from('configuracion_diaria').select('fecha, lecciones_totales').eq('seccion_id', seccionId) as { data: ConfigRow[] | null };

            const configMap: Record<string, number> = {};
            (configData || []).forEach(c => { configMap[c.fecha] = c.lecciones_totales; });

            const uniqueDates = Array.from(new Set((attData || []).map(a => a.fecha)));
            let totalProgrammedLessons = 0;
            uniqueDates.forEach(d => { totalProgrammedLessons += configMap[d] || 4; });

            // 3. Process each student
            const consolidated = students.map((est: Estudiante) => {
                // Cotidiano (35%)
                let tcAverage = 0;
                if (tcIds && tcIds.length > 0) {
                    let sumOfPercentages = 0;
                    tcIds.forEach((tcId: number) => {
                        const tcIndsForThis = (tcIndData || []).filter((i: any) => i.trabajo_id === tcId).map((i: any) => i.id);
                        if (tcIndsForThis.length > 0) {
                            const studentEvals = (tcEvalData || []).filter((ev: any) => ev.estudiante_id === est.cedula && tcIndsForThis.includes(ev.indicador_id));
                            const points = studentEvals.reduce((acc: number, curr: any) => acc + (curr.puntaje || 0), 0);
                            const max = tcIndsForThis.length * 3;
                            sumOfPercentages += (points / max) * 100;
                        }
                    });
                    tcAverage = (sumOfPercentages / tcIds.length) || 0;
                }
                const tcObtained = (tcAverage / 100) * 35;

                // Tareas (10%)
                let tarObtained = 0;
                if (tarData && tarData.length > 0) {
                    (tarData as any[]).forEach((tar: any) => {
                        const inds = (tarIndData || []).filter((i: any) => i.tarea_id === tar.id).map((i: any) => i.id);
                        const evals = (tarEvalData || []).filter((ev: any) => ev.estudiante_id === est.cedula && inds.includes(ev.indicador_id));
                        const points = evals.reduce((acc: number, curr: any) => acc + (curr.puntaje || 0), 0);
                        tarObtained += (points / tar.puntos_totales) * tar.porcentaje;
                    });
                }

                // Examenes (50%)
                let exObtained = 0;
                if (exData && exData.length > 0) {
                    (exData as any[]).forEach((ex: any) => {
                        const inds = (exIndData || []).filter((i: any) => i.examen_id === ex.id).map((i: any) => i.id);
                        const evals = (exEvalData || []).filter((ev: any) => ev.estudiante_id === est.cedula && inds.includes(ev.indicador_id));
                        const points = evals.reduce((acc: number, curr: any) => acc + (curr.puntaje || 0), 0);
                        exObtained += (points / ex.puntos_totales) * ex.porcentaje;
                    });
                }

                // Asistencia (5%)
                const studentAtt = (attData || []).filter(a => a.estudiante_id === est.cedula);
                let totalWeight = 0;
                studentAtt.forEach(att => {
                    if (!att.estados_asistencia?.es_justificada) {
                        const lessonsToday = configMap[att.fecha] || 4;
                        let weight = att.estados_asistencia?.peso_ausencia || 0;
                        if (lessonsToday < 4 && weight > 0) {
                            weight = (weight / 4) * lessonsToday;
                        }
                        totalWeight += weight;
                    }
                });
                const flooredAbsences = Math.floor(totalWeight);
                const absenteeismPercentage = totalProgrammedLessons > 0 ? (flooredAbsences / totalProgrammedLessons) * 100 : 0;
                let attObtained = 0;
                if (absenteeismPercentage < 10) attObtained = 5;
                else if (absenteeismPercentage < 20) attObtained = 4;
                else if (absenteeismPercentage < 30) attObtained = 3;
                else if (absenteeismPercentage < 40) attObtained = 2;
                else if (absenteeismPercentage < 50) attObtained = 1;
                else attObtained = 0;

                const totalFinal = tcObtained + tarObtained + exObtained + attObtained;

                return {
                    cedula: est.cedula,
                    nombreCompleto: `${est.apellidos} ${est.nombre}`,
                    cotidiano: tcObtained.toFixed(2),
                    tareas: tarObtained.toFixed(2),
                    examenes: exObtained.toFixed(2),
                    asistencia: attObtained.toFixed(2),
                    total: totalFinal.toFixed(2)
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
                    <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>Reporte Final de Notas</h1>
                    <p style={{ color: 'var(--text-muted)' }}>Consolidado académico semestral (Base 100%).</p>
                </div>
                <div style={{ display: 'flex', gap: '1rem' }} className="no-print">
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
                    body * { visibility: hidden; }
                    .report-page, .report-page * { visibility: visible; }
                    .report-page { position: absolute; left: 0; top: 0; width: 100%; padding: 0; background: white; }
                    .glass-card { background: white !important; border: none !important; color: black !important; box-shadow: none !important; }
                    .no-print { display: none !important; }
                    .only-print { display: block !important; }
                    table { width: 100% !important; border-collapse: collapse !important; color: black !important; }
                    th, td { border: 1px solid black !important; padding: 8px !important; color: black !important; }
                    th { background: #f0f0f0 !important; }
                    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
                }
            `}</style>
        </div>
    );
};
