import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Database } from '../types/database';
import { useToast } from './Toast';
import { ExamenSummary } from './ExamenSummary';

type Examen = Database['public']['Tables']['examenes']['Row'];
type IndicadorExamen = Database['public']['Tables']['indicadores_examen']['Row'];
type Estudiante = Database['public']['Tables']['estudiantes']['Row'];

export const ExamenesPage: React.FC = () => {
    const [secciones, setSecciones] = useState<any[]>([]);
    const [selectedSeccion, setSelectedSeccion] = useState<string>('');
    const [examenes, setExamenes] = useState<Examen[]>([]);
    const [selectedExamen, setSelectedExamen] = useState<string>('');
    const [indicadores, setIndicadores] = useState<IndicadorExamen[]>([]);
    const [estudiantes, setEstudiantes] = useState<Estudiante[]>([]);
    const [evaluaciones, setEvaluaciones] = useState<Record<string, Record<string, number>>>({});
    const [loading, setLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [showManager, setShowManager] = useState(false);
    const [showSummary, setShowSummary] = useState(false);
    const { showToast } = useToast();

    // Manager state
    const [editNombre, setEditNombre] = useState('');
    const [editPorcentaje, setEditPorcentaje] = useState<number>(25);
    const [editPuntosTotales, setEditPuntosTotales] = useState<number>(30);
    const [editIndicadores, setEditIndicadores] = useState<{ titulo: string, d0: string, d1: string, d2: string, d3: string }[]>([]);

    useEffect(() => {
        fetchInitialData();
    }, []);

    useEffect(() => {
        if (selectedSeccion) {
            fetchExamenes(selectedSeccion);
            fetchEstudiantes(selectedSeccion);
        }
    }, [selectedSeccion]);

    useEffect(() => {
        if (selectedExamen) {
            fetchIndicadoresAndEvaluations(selectedExamen);
        } else {
            setIndicadores([]);
            setEvaluaciones({});
        }
    }, [selectedExamen]);

    async function fetchInitialData() {
        const { data } = await supabase.from('secciones').select('*').order('nombre');
        setSecciones(data || []);
        if (data && data.length > 0) setSelectedSeccion((data[0] as any).id);
    }

    async function fetchExamenes(seccionId: string) {
        const { data } = await (supabase as any).from('examenes').select('*').eq('seccion_id', seccionId).order('id');
        setExamenes(data || []);
        if (data && data.length > 0) setSelectedExamen(String((data[0] as any).id));
        else setSelectedExamen('');
    }

    async function fetchEstudiantes(seccionId: string) {
        const { data } = await supabase.from('estudiantes').select('*').eq('seccion_id', seccionId).order('apellidos');
        setEstudiantes(data || []);
    }

    async function fetchIndicadoresAndEvaluations(examenId: string) {
        setLoading(true);
        const { data: indData } = await (supabase as any).from('indicadores_examen').select('*').eq('examen_id', parseInt(examenId)).order('orden');
        setIndicadores(indData || []);

        const indIds = (indData || []).map((i: any) => i.id);
        const { data: evalData } = await (supabase as any).from('evaluaciones_examen').select('*').in('indicador_id', indIds);

        const evalMap: Record<string, Record<string, number>> = {};
        (evalData || []).forEach((ev: any) => {
            if (!evalMap[ev.estudiante_id]) evalMap[ev.estudiante_id] = {};
            evalMap[ev.estudiante_id][ev.indicador_id] = ev.puntaje!;
        });
        setEvaluaciones(evalMap);
        setLoading(false);
    }

    const handleScoreClick = (estudianteId: string, indicadorId: string, score: number) => {
        setEvaluaciones(prev => ({
            ...prev,
            [estudianteId]: {
                ...(prev[estudianteId] || {}),
                [indicadorId]: score
            }
        }));
    };

    const handleToggleAllScores = (estudianteId: string) => {
        setEvaluaciones(prev => {
            const studentEvals = prev[estudianteId] || {};
            const allAreThree = indicadores.length > 0 && indicadores.every(ind => studentEvals[ind.id] === 3);
            const newScore = allAreThree ? 0 : 3;
            const updatedStudentEvals = { ...studentEvals };
            indicadores.forEach(ind => { updatedStudentEvals[ind.id] = newScore; });
            return { ...prev, [estudianteId]: updatedStudentEvals };
        });
    };

    const calculateGrades = (estudianteId: string) => {
        const currentExamen = examenes.find(e => String(e.id) === selectedExamen);
        if (!currentExamen || indicadores.length === 0) return { nota: 0, obtenido: 0 };

        const studentEvals = evaluaciones[estudianteId] || {};
        let points = 0;
        indicadores.forEach(ind => { points += studentEvals[ind.id] || 0; });

        const nota = Math.round((points / currentExamen.puntos_totales) * 100) || 0;
        const obtenido = Number(((nota / 100) * currentExamen.porcentaje).toFixed(2));

        return { nota, obtenido };
    };

    async function saveEvaluations() {
        setIsSaving(true);
        try {
            const upsertData: any[] = [];
            estudiantes.forEach(est => {
                const estEvals = evaluaciones[est.cedula] || {};
                indicadores.forEach(ind => {
                    if (estEvals[ind.id] !== undefined) {
                        upsertData.push({ estudiante_id: est.cedula, indicador_id: ind.id, puntaje: estEvals[ind.id] });
                    }
                });
            });

            if (upsertData.length > 0) {
                const { error } = await (supabase as any).from('evaluaciones_examen').upsert(upsertData, { onConflict: 'estudiante_id, indicador_id' });
                if (error) throw error;
            }
            showToast('Evaluaciones de examen guardadas', 'success');
        } catch (error: any) {
            showToast(`Error: ${error.message}`, 'error');
        } finally { setIsSaving(false); }
    }

    const handleNewExamen = () => {
        setEditNombre('');
        setEditPorcentaje(25);
        setEditPuntosTotales(30);
        setEditIndicadores([{ titulo: '', d0: '', d1: '', d2: '', d3: '' }, { titulo: '', d0: '', d1: '', d2: '', d3: '' }]);
        setShowManager(true);
    };

    async function createExamen() {
        if (!editNombre) return;
        setLoading(true);
        try {
            const { data: examen, error: eError } = await (supabase as any).from('examenes').insert({
                nombre: editNombre,
                seccion_id: selectedSeccion,
                porcentaje: editPorcentaje,
                puntos_totales: editPuntosTotales
            }).select().single();

            if (eError) throw eError;

            const indsData = editIndicadores.map((ind, idx) => ({
                examen_id: (examen as any).id,
                titulo: ind.titulo,
                orden: idx + 1,
                desc_0: ind.d0, desc_1: ind.d1, desc_2: ind.d2, desc_3: ind.d3
            }));

            const { error: indError } = await (supabase as any).from('indicadores_examen').insert(indsData);
            if (indError) throw indError;

            showToast('Examen configurado correctamente', 'success');
            setShowManager(false);
            fetchExamenes(selectedSeccion);
        } catch (error: any) {
            showToast(`Error: ${error.message}`, 'error');
        } finally { setLoading(false); }
    }

    return (
        <div className="examenes-page">
            <header style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <div>
                    <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>Exámenes</h1>
                    <p style={{ color: 'var(--text-muted)' }}>Gestión y calificación de pruebas o evaluaciones sumativas.</p>
                </div>
                <div style={{ display: 'flex', gap: '1rem' }}>
                    <select
                        value={selectedSeccion}
                        onChange={e => setSelectedSeccion(e.target.value)}
                        className="glass-card"
                        style={{ padding: '0.75rem 1rem', background: 'rgba(255,255,255,0.05)', color: 'white', border: 'none' }}
                    >
                        {secciones.map(s => <option key={s.id} value={s.id} style={{ background: '#1e1b4b' }}>{s.nombre}</option>)}
                    </select>
                    <button onClick={() => setShowSummary(true)} className="btn-primary" style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid var(--glass-border)' }}>
                        📊 Resumen de Notas
                    </button>
                    <button onClick={handleNewExamen} className="btn-primary" style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid var(--glass-border)' }}>
                        ➕ Configurar Examen
                    </button>
                </div>
            </header>

            {!showManager ? (
                <div className="evaluation-view">
                    <div className="glass-card" style={{ padding: '1.5rem', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                <label style={{ fontSize: '1rem', fontWeight: 'bold', color: 'var(--primary)' }}>CALIFICAR:</label>
                                <select
                                    value={selectedExamen}
                                    onChange={e => setSelectedExamen(e.target.value)}
                                    className="glass-card"
                                    style={{
                                        padding: '0.6rem 1.5rem',
                                        background: 'rgba(255,255,255,0.1)',
                                        color: 'white',
                                        border: '1px solid var(--primary)',
                                        fontSize: '1rem',
                                        fontWeight: 'bold',
                                        minWidth: '250px'
                                    }}
                                >
                                    {examenes.map(e => <option key={e.id} value={e.id} style={{ background: '#1e1b4b' }}>{e.nombre} ({e.porcentaje}%)</option>)}
                                    {examenes.length === 0 && <option value="">No hay exámenes creados</option>}
                                </select>
                            </div>
                            {selectedExamen && (
                                <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.9rem' }}>
                                    <div style={{ color: 'var(--primary)' }}><strong>Puntos Totales:</strong> {examenes.find(e => String(e.id) === selectedExamen)?.puntos_totales}</div>
                                    <div style={{ color: 'var(--primary)' }}><strong>Valor:</strong> {examenes.find(e => String(e.id) === selectedExamen)?.porcentaje}%</div>
                                </div>
                            )}
                        </div>
                        <div style={{ display: 'flex', gap: '1rem' }}>
                            <button onClick={saveEvaluations} disabled={isSaving || !selectedExamen} className="btn-primary">
                                {isSaving ? '⌛ Guardando...' : '💾 Guardar Notas'}
                            </button>
                            {selectedExamen && (
                                <button
                                    onClick={async () => {
                                        if (confirm('¿Estás seguro de eliminar este examen y todas sus notas?')) {
                                            const { error } = await supabase.from('examenes').delete().eq('id', parseInt(selectedExamen));
                                            if (!error) fetchExamenes(selectedSeccion);
                                        }
                                    }}
                                    className="btn-primary"
                                    style={{ background: 'var(--danger)', opacity: 0.8 }}
                                >
                                    🗑️ Eliminar
                                </button>
                            )}
                        </div>
                    </div>

                    {selectedExamen && (
                        <div className="glass-card" style={{ overflowX: 'auto', padding: '0' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--glass-border)' }}>
                                        <th style={{ textAlign: 'left', padding: '1rem 1.5rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>Estudiante</th>
                                        <th style={{ textAlign: 'center', padding: '1rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>MIN/MAX</th>
                                        {indicadores.map((ind, idx) => (
                                            <th key={ind.id} style={{ textAlign: 'center', padding: '1rem', fontSize: '0.7rem', maxWidth: '120px' }} title={ind.titulo}>
                                                I{idx + 1}
                                                <div style={{ fontSize: '0.6rem', fontWeight: 400, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ind.titulo}</div>
                                            </th>
                                        ))}
                                        <th style={{ textAlign: 'center', padding: '1rem', fontSize: '0.8rem', color: 'var(--primary)', fontWeight: 700 }}>NOTA</th>
                                        <th style={{ textAlign: 'center', padding: '1rem', fontSize: '0.8rem', color: 'var(--primary)', fontWeight: 700 }}>VALOR</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {estudiantes.map(est => {
                                        const { nota, obtenido } = calculateGrades(est.cedula);
                                        const studentEvals = evaluaciones[est.cedula] || {};
                                        const allAreThree = indicadores.length > 0 && indicadores.every(ind => studentEvals[ind.id] === 3);

                                        return (
                                            <tr key={est.cedula} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                                <td style={{ padding: '1rem 1.5rem', fontSize: '0.9rem' }}>{est.apellidos}, {est.nombre}</td>
                                                <td style={{ textAlign: 'center' }}>
                                                    <button onClick={() => handleToggleAllScores(est.cedula)} style={{ fontSize: '9px', padding: '4px 8px', borderRadius: '8px', background: allAreThree ? 'var(--danger)' : 'var(--primary)', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>{allAreThree ? 'MIN' : 'MAX'}</button>
                                                </td>
                                                {indicadores.map(ind => {
                                                    const score = evaluaciones[est.cedula]?.[ind.id] ?? null;
                                                    return (
                                                        <td key={ind.id} style={{ textAlign: 'center', padding: '0.5rem' }}>
                                                            <div style={{ display: 'flex', gap: '2px', justifyContent: 'center' }}>
                                                                {[0, 1, 2, 3].map(level => (
                                                                    <button key={level} onClick={() => handleScoreClick(est.cedula, ind.id, level)} title={level === 0 ? (ind.desc_0 ?? '') : level === 1 ? (ind.desc_1 ?? '') : level === 2 ? (ind.desc_2 ?? '') : (ind.desc_3 ?? '')} style={{ width: '24px', height: '24px', borderRadius: '4px', border: 'none', background: score === level ? 'var(--primary)' : 'rgba(255,255,255,0.05)', color: 'white', fontSize: '10px', cursor: 'pointer' }}>{level}</button>
                                                                ))}
                                                            </div>
                                                        </td>
                                                    );
                                                })}
                                                <td style={{ textAlign: 'center', fontWeight: 700, color: nota >= 70 ? 'var(--primary)' : 'var(--danger)' }}>{nota}%</td>
                                                <td style={{ textAlign: 'center', fontWeight: 700, color: nota >= 70 ? 'var(--primary)' : 'var(--danger)' }}>{obtenido}%</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            ) : (
                <div className="manager-view glass-card" style={{ padding: '2rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                        <h2>Configurar Examen</h2>
                        <button onClick={() => setShowManager(false)} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}>✕ Cancelar</button>
                    </div>

                    <div className="grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem', marginBottom: '2rem' }}>
                        <div style={{ gridColumn: 'span 2' }}>
                            <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Nombre del Examen</label>
                            <input type="text" value={editNombre} onChange={e => setEditNombre(e.target.value)} className="glass-card" style={{ width: '100%', padding: '1rem', background: 'rgba(255,255,255,0.05)', color: 'white', border: 'none' }} placeholder="Ej: Primer Examen Trimestral" />
                        </div>
                        <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Valor Porcentual (%)</label>
                            <input type="number" step="0.5" value={editPorcentaje} onChange={e => setEditPorcentaje(parseFloat(e.target.value))} className="glass-card" style={{ width: '100%', padding: '1rem', background: 'rgba(255,255,255,0.05)', color: 'white', border: 'none' }} />
                        </div>
                        <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Puntos Totales</label>
                            <input type="number" value={editPuntosTotales} onChange={e => setEditPuntosTotales(parseInt(e.target.value))} className="glass-card" style={{ width: '100%', padding: '1rem', background: 'rgba(255,255,255,0.05)', color: 'white', border: 'none' }} />
                        </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        {editIndicadores.map((ind, idx) => (
                            <div key={idx} className="glass-card" style={{ padding: '1.5rem', background: 'rgba(255,255,255,0.02)' }}>
                                <div style={{ marginBottom: '1rem', fontWeight: 600, color: 'var(--primary)' }}>Indicador I{idx + 1}</div>
                                <input type="text" placeholder="Título del indicador..." value={ind.titulo} onChange={e => { const n = [...editIndicadores]; n[idx].titulo = e.target.value; setEditIndicadores(n); }} className="glass-card" style={{ width: '100%', padding: '0.75rem', marginBottom: '1rem', background: 'rgba(255,255,255,0.05)', color: 'white', border: 'none' }} />
                                <div className="grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
                                    {[0, 1, 2, 3].map(level => (
                                        <div key={level}>
                                            <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Nivel {level}</label>
                                            <textarea value={(ind as any)[`d${level}`]} onChange={e => { const n = [...editIndicadores]; (n[idx] as any)[`d${level}`] = e.target.value; setEditIndicadores(n); }} className="glass-card" style={{ width: '100%', height: '50px', padding: '0.5rem', background: 'rgba(255,255,255,0.02)', color: 'white', border: 'none', fontSize: '0.8rem' }} />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>

                    <div style={{ marginTop: '2rem', display: 'flex', gap: '1rem' }}>
                        {editIndicadores.length < 5 && <button onClick={() => setEditIndicadores([...editIndicadores, { titulo: '', d0: '', d1: '', d2: '', d3: '' }])} className="btn-primary" style={{ background: 'rgba(255,255,255,0.1)' }}>➕ Añadir Indicador</button>}
                        <button onClick={createExamen} disabled={loading} className="btn-primary">{loading ? '⌛ Guardando...' : '✅ Finalizar Configuración'}</button>
                    </div>
                </div>
            )}

            {showSummary && selectedSeccion && (
                <ExamenSummary
                    seccionId={selectedSeccion}
                    onClose={() => setShowSummary(false)}
                />
            )}
        </div>
    );
};
