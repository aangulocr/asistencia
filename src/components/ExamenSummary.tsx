import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface ExamenSummaryProps {
    seccionId: string;
    onClose: () => void;
}

export const ExamenSummary: React.FC<ExamenSummaryProps> = ({ seccionId, onClose }) => {
    const [loading, setLoading] = useState(true);
    const [seccionName, setSeccionName] = useState('');
    const [estudiantes, setEstudiantes] = useState<any[]>([]);
    const [examenes, setExamenes] = useState<any[]>([]);
    const [gradesMap, setGradesMap] = useState<Record<string, Record<number, { nota: number, obtenido: number }>>>({}); // student_id -> examen_id -> grades

    useEffect(() => {
        fetchData();
    }, [seccionId]);

    async function fetchData() {
        setLoading(true);
        try {
            // Seccion info
            const { data: secData } = await (supabase as any).from('secciones').select('nombre').eq('id', seccionId).single();
            setSeccionName(secData?.nombre || '');

            // Students
            const { data: estData } = await supabase.from('estudiantes').select('*').eq('seccion_id', seccionId).order('apellidos');
            const students = estData || [];
            setEstudiantes(students);

            // Exams
            const { data: exData } = await (supabase as any).from('examenes').select('*').eq('seccion_id', seccionId).order('id');
            const exams = exData || [];
            setExamenes(exams);

            if (exams.length > 0) {
                const exIds = exams.map((e: any) => e.id);
                // Indicators
                const { data: indData } = await (supabase as any).from('indicadores_examen').select('*').in('examen_id', exIds);
                const indicators = indData || [];

                // Evaluations
                const { data: evalData } = await (supabase as any).from('evaluaciones_examen').select('*').in('indicador_id', indicators.map((i: any) => i.id));
                const evaluations = evalData || [];

                // Calculate grades
                const newGradesMap: any = {};
                students.forEach((est: any) => {
                    newGradesMap[est.cedula] = {};
                    exams.forEach((ex: any) => {
                        const exInds = indicators.filter((i: any) => i.examen_id === ex.id);
                        const studentEvals = evaluations.filter((ev: any) =>
                            ev.estudiante_id === est.cedula &&
                            exInds.some((i: any) => i.id === ev.indicador_id)
                        );

                        let pointsPaid = 0;
                        studentEvals.forEach((ev: any) => { pointsPaid += ev.puntaje || 0; });

                        const nota = Math.round((pointsPaid / ex.puntos_totales) * 100) || 0;
                        const obtenido = Number(((nota / 100) * ex.porcentaje).toFixed(2));

                        newGradesMap[est.cedula][ex.id] = { nota, obtenido };
                    });
                });
                setGradesMap(newGradesMap);
            }
        } catch (error) {
            console.error('Error fetching summary data:', error);
        } finally {
            setLoading(false);
        }
    }

    const handlePrint = () => { window.print(); };

    return (
        <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '2rem' }}>
            <div className="glass-card" style={{ width: '100%', maxWidth: '1000px', maxHeight: '90vh', overflow: 'auto', padding: '2rem', position: 'relative', background: '#1e1b4b' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }} className="no-print">
                    <h2 style={{ margin: 0 }}>Resumen de Exámenes - {seccionName}</h2>
                    <div style={{ display: 'flex', gap: '1rem' }}>
                        <button onClick={handlePrint} className="btn-primary" style={{ background: 'var(--primary)' }}>🖨️ Imprimir PDF</button>
                        <button onClick={onClose} className="btn-primary" style={{ background: 'rgba(255,255,255,0.1)' }}>Cerrar</button>
                    </div>
                </div>

                <div className="only-print" style={{ display: 'none', textAlign: 'center', marginBottom: '2rem' }}>
                    <h1 style={{ color: 'black' }}>Reporte de Exámenes - MEP 2026</h1>
                    <h2 style={{ color: 'black' }}>Sección: {seccionName}</h2>
                </div>

                {loading ? (
                    <div style={{ textAlign: 'center', padding: '3rem' }}>Cargando resumen...</div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                            <thead>
                                <tr style={{ borderBottom: '2px solid var(--glass-border)' }}>
                                    <th style={{ textAlign: 'left', padding: '1rem' }}>Estudiante</th>
                                    {examenes.map(e => (
                                        <th key={e.id} style={{ textAlign: 'center', padding: '1rem' }}>
                                            {e.nombre}
                                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>({e.porcentaje}%)</div>
                                        </th>
                                    ))}
                                    <th style={{ textAlign: 'center', padding: '1rem', color: 'var(--primary)' }}>TOTAL PRUEBAS (50%)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {estudiantes.map(est => {
                                    let totalPorcentaje = 0;
                                    return (
                                        <tr key={est.cedula} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                            <td style={{ padding: '0.75rem 1rem' }}>{est.apellidos}, {est.nombre}</td>
                                            {examenes.map(ex => {
                                                const grade = gradesMap[est.cedula]?.[ex.id] || { nota: 0, obtenido: 0 };
                                                totalPorcentaje += grade.obtenido;
                                                return (
                                                    <td key={ex.id} style={{ textAlign: 'center', padding: '0.75rem' }}>
                                                        <div style={{ fontWeight: 600 }}>{grade.nota}%</div>
                                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{grade.obtenido}%</div>
                                                    </td>
                                                );
                                            })}
                                            <td style={{ textAlign: 'center', padding: '0.75rem', fontWeight: 800, color: 'var(--primary)', fontSize: '1rem' }}>
                                                {totalPorcentaje.toFixed(2)}%
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}

                <style>{`
                    @media print {
                        @page { 
                            size: landscape; 
                            margin: 10mm; 
                        }
                        
                        /* Ocultar todo lo que no sea el modal */
                        body * { visibility: hidden; }
                        .modal-overlay, .modal-overlay * { visibility: visible; }
                        
                        /* Posicionar el modal como el elemento principal de la página */
                        .modal-overlay { 
                            position: absolute !important; 
                            left: 0 !important; 
                            top: 0 !important; 
                            width: 100% !important; 
                            background: white !important; 
                            padding: 0 !important;
                            display: block !important;
                        }
                        
                        .glass-card { 
                            background: white !important; 
                            border: none !important; 
                            color: black !important; 
                            width: 100% !important; 
                            max-width: 100% !important;
                            box-shadow: none !important;
                            padding: 0 !important;
                        }
                        
                        .no-print { display: none !important; }
                        .only-print { display: block !important; }
                        
                        h1, h2, h3, p, div, span { color: black !important; }
                        
                        table { 
                            width: 100% !important; 
                            border-collapse: collapse !important; 
                            color: black !important; 
                            font-size: 10pt !important;
                            margin-top: 10px !important;
                        }
                        
                        th { 
                            border: 1px solid black !important; 
                            color: black !important; 
                            background: #f0f0f0 !important;
                            padding: 8px !important;
                        }
                        
                        td { 
                            border: 1px solid black !important; 
                            color: black !important; 
                            padding: 8px !important;
                        }
                        
                        tr { page-break-inside: avoid; }
                        
                        * { 
                            -webkit-print-color-adjust: exact !important; 
                            print-color-adjust: exact !important; 
                        }
                    }
                `}</style>
            </div>
        </div>
    );
};
