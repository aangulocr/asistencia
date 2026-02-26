import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Database } from '../types/database';
import { useToast } from './Toast';
import { TareaSummary } from './TareaSummary';
import { SupabaseClient } from '@supabase/supabase-js';

const typedSupabase = supabase as SupabaseClient<Database>;

type Tarea = Database['public']['Tables']['tareas']['Row'];
type IndicadorTarea = Database['public']['Tables']['indicadores_tarea']['Row'];
type Estudiante = Database['public']['Tables']['estudiantes']['Row'];

interface Props {
    periodo: number;
}

export const TareasPage: React.FC<Props> = ({ periodo }) => {
    const [secciones, setSecciones] = useState<any[]>([]);
    const [selectedSeccion, setSelectedSeccion] = useState<string>('');
    const [tareas, setTareas] = useState<Tarea[]>([]);
    const [selectedTarea, setSelectedTarea] = useState<string>('');
    const [indicadores, setIndicadores] = useState<IndicadorTarea[]>([]);
    const [estudiantes, setEstudiantes] = useState<Estudiante[]>([]);
    const [evaluaciones, setEvaluaciones] = useState<Record<string, Record<string, number>>>({});
    const [loading, setLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [showManager, setShowManager] = useState(false);
    const [showSummary, setShowSummary] = useState(false);
    const { showToast } = useToast();

    // Manager state
    const [editNombre, setEditNombre] = useState('');
    const [editPorcentaje, setEditPorcentaje] = useState<number>(2.5);
    const [editPuntosTotales, setEditPuntosTotales] = useState<number>(10);
    const [editIndicadores, setEditIndicadores] = useState<{ titulo: string, d0: string, d1: string, d2: string, d3: string }[]>([]);

    useEffect(() => {
        fetchInitialData();
    }, []);

    useEffect(() => {
        if (selectedSeccion) {
            fetchTareas(selectedSeccion);
            fetchEstudiantes(selectedSeccion);
        }
    }, [selectedSeccion, periodo]);

    useEffect(() => {
        if (selectedTarea) {
            fetchIndicadoresAndEvaluations(selectedTarea);
        } else {
            setIndicadores([]);
            setEvaluaciones({});
        }
    }, [selectedTarea]);

    async function fetchInitialData() {
        const { data } = await typedSupabase.from('secciones').select('*').order('nombre');
        setSecciones(data || []);
        if (data && data.length > 0) setSelectedSeccion(data[0].id);
    }

    async function fetchTareas(seccionId: string) {
        const { data } = await typedSupabase.from('tareas').select('*').eq('seccion_id', seccionId).eq('periodo', periodo).order('id');
        setTareas(data || []);
        if (data && data.length > 0) setSelectedTarea(String(data[0].id));
        else setSelectedTarea('');
    }

    async function fetchEstudiantes(seccionId: string) {
        const { data } = await typedSupabase.from('estudiantes').select('*').eq('seccion_id', seccionId).order('apellidos');
        setEstudiantes(data || []);
    }

    async function fetchIndicadoresAndEvaluations(tareaId: string) {
        setLoading(true);
        const { data: indData } = await typedSupabase.from('indicadores_tarea').select('*').eq('tarea_id', parseInt(tareaId)).order('orden');
        setIndicadores(indData || []);

        const indIds = (indData || []).map(i => i.id);
        const { data: evalData } = await typedSupabase.from('evaluaciones_tarea').select('*').in('indicador_id', indIds);

        const evalMap: Record<string, Record<string, number>> = {};
        (evalData || []).forEach(ev => {
            if (!evalMap[ev.estudiante_id]) evalMap[ev.estudiante_id] = {};
            evalMap[ev.estudiante_id][ev.indicador_id] = ev.puntaje || 0;
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
        const currentTarea = tareas.find(t => String(t.id) === selectedTarea);
        if (!currentTarea || indicadores.length === 0) return { nota: 0, obtenido: 0 };

        const studentEvals = evaluaciones[estudianteId] || {};
        let points = 0;
        indicadores.forEach(ind => { points += studentEvals[ind.id] || 0; });

        const nota = Math.round((points / currentTarea.puntos_totales) * 100) || 0;
        const obtenido = Number(((nota / 100) * currentTarea.porcentaje).toFixed(2));

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
                const { error } = await typedSupabase.from('evaluaciones_tarea').upsert(upsertData, { onConflict: 'estudiante_id, indicador_id' });
                if (error) throw error;
            }
            showToast('Evaluaciones de tarea guardadas', 'success');
        } catch (error: any) {
            showToast(`Error: ${error.message}`, 'error');
        } finally { setIsSaving(false); }
    }

    const handleNewTarea = () => {
        setEditNombre('');
        setEditPorcentaje(2.5);
        setEditPuntosTotales(10);
        setEditIndicadores([{ titulo: '', d0: '', d1: '', d2: '', d3: '' }, { titulo: '', d0: '', d1: '', d2: '', d3: '' }]);
        setShowManager(true);
    };

    async function createTarea() {
        if (!editNombre) return;
        setLoading(true);
        try {
            const { data: tarea, error: tError } = await supabase.from('tareas').insert({
                nombre: editNombre,
                seccion_id: selectedSeccion,
                porcentaje: editPorcentaje,
                puntos_totales: editPuntosTotales,
                periodo: periodo
            }).select().single();

            if (tError) throw tError;

            const indsData: Database['public']['Tables']['indicadores_tarea']['Insert'][] = editIndicadores.map((ind, idx) => ({
                tarea_id: tarea!.id,
                titulo: ind.titulo,
                orden: idx + 1,
                desc_0: ind.d0, desc_1: ind.d1, desc_2: ind.d2, desc_3: ind.d3
            }));

            const { error: indError } = await typedSupabase.from('indicadores_tarea').insert(indsData);
            if (indError) throw indError;

            showToast('Tarea creada correctamente', 'success');
            setShowManager(false);
            fetchTareas(selectedSeccion);
        } catch (error: any) {
            showToast(`Error: ${error.message}`, 'error');
        } finally { setLoading(false); }
    }

    return (
        <div className="tareas-page">
            <header style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <div>
                    <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>Tareas</h1>
                    <p style={{ color: 'var(--text-muted)' }}>Calificación de tareas con rúbrica y porcentaje personalizado.</p>
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
                    <button onClick={handleNewTarea} className="btn-primary" style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid var(--glass-border)' }}>
                        ➕ Nueva Tarea
                    </button>
                </div>
            </header>

            {!showManager ? (
                <div className="evaluation-view">
                    <div className="glass-card" style={{ padding: '1.5rem', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                <label style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Seleccionar Tarea:</label>
                                <select
                                    value={selectedTarea}
                                    onChange={e => setSelectedTarea(e.target.value)}
                                    className="glass-card"
                                    style={{ padding: '0.5rem 1rem', background: 'rgba(255,255,255,0.05)', color: 'white', border: 'none' }}
                                >
                                    {tareas.map(t => <option key={t.id} value={t.id} style={{ background: '#1e1b4b' }}>{t.nombre} ({t.porcentaje}%)</option>)}
                                    {tareas.length === 0 && <option value="">No hay tareas creadas</option>}
                                </select>
                            </div>
                            {selectedTarea && (
                                <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.9rem' }}>
                                    <div style={{ color: 'var(--primary)' }}><strong>Puntos Totales:</strong> {tareas.find(t => String(t.id) === selectedTarea)?.puntos_totales}</div>
                                    <div style={{ color: 'var(--primary)' }}><strong>Valor:</strong> {tareas.find(t => String(t.id) === selectedTarea)?.porcentaje}%</div>
                                </div>
                            )}
                        </div>
                        <div style={{ display: 'flex', gap: '1rem' }}>
                            <button onClick={saveEvaluations} disabled={isSaving || !selectedTarea} className="btn-primary">
                                {isSaving ? '⌛ Guardando...' : '💾 Guardar Notas'}
                            </button>
                            {selectedTarea && (
                                <button
                                    onClick={async () => {
                                        if (confirm('¿Estás seguro de eliminar esta tarea y todas sus notas?')) {
                                            const { error } = await supabase.from('tareas').delete().eq('id', parseInt(selectedTarea));
                                            if (error) {
                                                showToast(`Error al eliminar: ${error.message}`, 'error');
                                            } else {
                                                showToast('Tarea eliminada correctamente', 'success');
                                                fetchTareas(selectedSeccion);
                                            }
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

                    {selectedTarea && (
                        <div className="glass-card" style={{ overflowX: 'auto', padding: '0' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--glass-border)' }}>
                                        <th style={{ textAlign: 'left', padding: '1rem 1.5rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>Estudiante</th>
                                        <th style={{ textAlign: 'center', padding: '1rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>All</th>
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
                                                    <button onClick={() => handleToggleAllScores(est.cedula)} style={{ fontSize: '9px', padding: '4px 8px', borderRadius: '8px', background: allAreThree ? 'var(--danger)' : 'var(--primary)', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>{allAreThree ? 'CERO' : 'MAX'}</button>
                                                </td>
                                                {indicadores.map(ind => {
                                                    const score = evaluaciones[est.cedula]?.[ind.id] ?? null;
                                                    return (
                                                        <td key={ind.id} style={{ textAlign: 'center', padding: '0.5rem' }}>
                                                            <div style={{ display: 'flex', gap: '2px', justifyContent: 'center' }}>
                                                                {[0, 1, 2, 3].map(s => (
                                                                    <button key={s} onClick={() => handleScoreClick(est.cedula, ind.id, s)} title={s === 0 ? (ind.desc_0 ?? '') : s === 1 ? (ind.desc_1 ?? '') : s === 2 ? (ind.desc_2 ?? '') : (ind.desc_3 ?? '')} style={{ width: '24px', height: '24px', borderRadius: '4px', border: 'none', background: score === s ? 'var(--primary)' : 'rgba(255,255,255,0.05)', color: 'white', fontSize: '10px', cursor: 'pointer' }}>{s}</button>
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
                        <h2>Nueva Tarea</h2>
                        <button onClick={() => setShowManager(false)} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}>✕ Cancelar</button>
                    </div>

                    <div className="grid" style={{ gridTemplateColumns: 'repea(3, 1fr)', gap: '1.5rem', marginBottom: '2rem' }}>
                        <div style={{ gridColumn: 'span 2' }}>
                            <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Nombre de la Tarea</label>
                            <input type="text" value={editNombre} onChange={e => setEditNombre(e.target.value)} className="glass-card" style={{ width: '100%', padding: '1rem', background: 'rgba(255,255,255,0.05)', color: 'white', border: 'none' }} placeholder="Ej: Tarea 1 - Investigación" />
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
                        <button onClick={createTarea} disabled={loading} className="btn-primary">{loading ? '⌛ Creando...' : '✅ Crear Tarea y Rúbrica'}</button>
                    </div>
                </div>
            )}

            {showSummary && selectedSeccion && (
                <TareaSummary
                    seccionId={selectedSeccion}
                    periodo={periodo}
                    onClose={() => setShowSummary(false)}
                />
            )}
        </div>
    );
};
