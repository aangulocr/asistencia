import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Database } from '../types/database';

interface CotidianoSummaryProps {
    seccionId: string;
    onClose: () => void;
}

export const CotidianoSummary: React.FC<CotidianoSummaryProps> = ({ seccionId, onClose }) => {
    const [seccionNombre, setSeccionNombre] = useState('');
    const [estudiantes, setEstudiantes] = useState<any[]>([]);
    const [trabajos, setTrabajos] = useState<any[]>([]);
    const [indicadores, setIndicadores] = useState<any[]>([]);
    const [evaluaciones, setEvaluaciones] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchData();
    }, [seccionId]);

    async function fetchData() {
        setLoading(true);
        try {
            // 1. Fetch Section Name
            const { data: secData } = await supabase.from('secciones').select('nombre').eq('id', seccionId).single();
            setSeccionNombre((secData as any)?.nombre || '');

            // 2. Fetch Students
            const { data: estData } = await supabase.from('estudiantes').select('*').eq('seccion_id', seccionId).order('apellidos');
            setEstudiantes(estData || []);

            // 3. Fetch TCs for this section
            const { data: tcData } = await (supabase as any).from('trabajos_cotidianos').select('*').eq('seccion_id', seccionId).order('id');
            const currentTrabajos = tcData || [];
            setTrabajos(currentTrabajos);

            if (currentTrabajos.length > 0) {
                const tcIds = currentTrabajos.map((t: any) => t.id);

                // 4. Fetch Indicators for these TCs
                const { data: indData } = await (supabase as any).from('indicadores').select('*').in('trabajo_id', tcIds);
                setIndicadores(indData || []);

                const indIds = (indData || []).map((i: any) => i.id);

                // 5. Fetch Evaluations for these Indicators
                if (indIds.length > 0) {
                    const { data: evalData } = await (supabase as any).from('evaluaciones_cotidiano').select('*').in('indicador_id', indIds);
                    setEvaluaciones(evalData || []);
                }
            }
        } catch (error) {
            console.error('Error fetching summary data:', error);
        } finally {
            setLoading(false);
        }
    }

    const [gradesMap, setGradesMap] = useState<Record<string, Record<number, number>>>({}); // studentId -> tcId -> grade

    useEffect(() => {
        if (estudiantes.length > 0 && trabajos.length > 0) {
            calculateAllGrades();
        }
    }, [estudiantes, trabajos, indicadores, evaluaciones]);

    const calculateAllGrades = () => {
        const newGradesMap: Record<string, Record<number, number>> = {};

        estudiantes.forEach(est => {
            newGradesMap[est.cedula] = {};
            trabajos.forEach(tc => {
                const tcIndicators = indicadores.filter(ind => ind.trabajo_id === tc.id);
                if (tcIndicators.length > 0) {
                    const tcIndIds = tcIndicators.map(i => i.id);
                    const studentEvals = evaluaciones.filter(ev => ev.estudiante_id === est.cedula && tcIndIds.includes(ev.indicador_id));
                    const totalPoints = studentEvals.reduce((acc, curr) => acc + (curr.puntaje || 0), 0);
                    const maxPoints = tcIndicators.length * 3;
                    newGradesMap[est.cedula][tc.id] = Math.round((totalPoints / maxPoints) * 100) || 0;
                } else {
                    newGradesMap[est.cedula][tc.id] = 0;
                }
            });
        });
        setGradesMap(newGradesMap);
    };

    const handlePrint = () => {
        window.print();
    };

    if (loading) return (
        <div className="modal-overlay">
            <div className="glass-card" style={{ padding: '2rem', textAlign: 'center' }}>⌛ Cargando resumen...</div>
        </div>
    );

    return (
        <div className="modal-overlay" style={{ background: 'rgba(0,0,0,0.8)', zIndex: 1000 }}>
            <div className="glass-card" style={{ width: '98%', maxWidth: '1400px', maxHeight: '95vh', overflowY: 'auto', padding: '2rem', position: 'relative' }}>
                <button onClick={onClose} style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', color: 'white', fontSize: '1.5rem', cursor: 'pointer' }}>✕</button>

                <header style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }} className="no-print">
                    <div>
                        <h2 style={{ fontSize: '1.8rem' }}>Resumen de Notas: {seccionNombre}</h2>
                        <p style={{ color: 'var(--text-muted)' }}>Consolidado de Trabajo Cotidiano ({trabajos.length} trabajos)</p>
                    </div>
                    <button onClick={handlePrint} className="btn-primary" style={{ background: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        🖨️ Imprimir PDF (Horizontal)
                    </button>
                </header>

                <div className="print-area">
                    <div className="only-print" style={{ marginBottom: '2rem', display: 'none' }}>
                        <h1 style={{ color: 'black', textAlign: 'center' }}>Reporte de Notas - Trabajo Cotidiano</h1>
                        <h2 style={{ color: 'black', textAlign: 'center' }}>Sección: {seccionNombre}</h2>
                        <p style={{ color: 'black', textAlign: 'center' }}>Fecha de generación: {new Date().toLocaleDateString()}</p>
                    </div>

                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: trabajos.length > 10 ? '0.8rem' : '0.9rem' }}>
                            <thead>
                                <tr style={{ background: 'rgba(255,255,255,0.05)', borderBottom: '2px solid var(--glass-border)' }}>
                                    <th style={{ textAlign: 'left', padding: '1rem', color: 'var(--text-muted)' }}>ESTUDIANTE</th>
                                    {trabajos.map((t, idx) => (
                                        <th key={t.id} style={{ textAlign: 'center', padding: '0.5rem', color: 'var(--text-muted)', minWidth: '60px' }}>
                                            TC{idx + 1}
                                            <div style={{ fontSize: '0.6rem', fontWeight: 400, maxWidth: '80px', margin: '0 auto', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.nombre}</div>
                                        </th>
                                    ))}
                                    <th style={{ textAlign: 'center', padding: '1rem', color: 'var(--primary)', fontWeight: 700 }}>PROMEDIO</th>
                                </tr>
                            </thead>
                            <tbody>
                                {estudiantes.map(est => {
                                    const studentGrades = gradesMap[est.cedula] || {};
                                    let totalSum = 0;
                                    trabajos.forEach(t => {
                                        totalSum += studentGrades[t.id] || 0;
                                    });
                                    const average = trabajos.length > 0 ? Math.round(totalSum / trabajos.length) : 0;

                                    return (
                                        <tr key={est.cedula} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                            <td style={{ padding: '0.75rem 1rem', whiteSpace: 'nowrap' }}>{est.apellidos}, {est.nombre}</td>
                                            {trabajos.map(t => {
                                                const g = studentGrades[t.id] || 0;
                                                return (
                                                    <td key={t.id} style={{ textAlign: 'center', padding: '0.5rem', color: g < 70 ? 'var(--danger)' : 'white' }}>
                                                        {g}%
                                                    </td>
                                                );
                                            })}
                                            <td style={{ textAlign: 'center', padding: '1rem', fontWeight: 700, color: average >= 70 ? 'var(--primary)' : 'var(--danger)' }}>
                                                {average}%
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>

                <style>{`
                    @media print {
                        @page { 
                            size: landscape; 
                            margin: 10mm; 
                        }
                        
                        /* Hide everything by default */
                        body * {
                            visibility: hidden;
                        }
                        
                        /* Show only the modal and its contents */
                        .modal-overlay, .modal-overlay * {
                            visibility: visible;
                        }
                        
                        .modal-overlay {
                            position: absolute !important;
                            left: 0 !important;
                            top: 0 !important;
                            width: 100% !important;
                            height: auto !important;
                            background: white !important;
                            display: block !important;
                            padding: 0 !important;
                            margin: 0 !important;
                        }

                        .glass-card {
                            background: white !important;
                            color: black !important;
                            box-shadow: none !important;
                            border: none !important;
                            width: 100% !important;
                            max-width: 100% !important;
                            padding: 0 !important;
                        }
                        
                        .no-print {
                            display: none !important;
                        }

                        .only-print {
                            display: block !important;
                            color: black !important;
                            margin-bottom: 2rem !important;
                        }

                        table {
                            width: 100% !important;
                            border-collapse: collapse !important;
                            color: black !important;
                            font-size: 9pt !important;
                        }

                        th {
                            color: black !important;
                            border-bottom: 2px solid black !important;
                            padding: 8px !important;
                        }

                        td {
                            color: black !important;
                            border-bottom: 1px solid #ccc !important;
                            padding: 6px !important;
                        }

                        /* Ensure text colors are printed */
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
