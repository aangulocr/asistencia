import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Database } from '../types/database';
import { useToast } from './Toast';
import { CotidianoSummary } from './CotidianoSummary';
import { SupabaseClient } from '@supabase/supabase-js';

const typedSupabase = supabase as SupabaseClient<Database>;

type Trabajo = Database['public']['Tables']['trabajos_cotidianos']['Row'];
type Indicador = Database['public']['Tables']['indicadores']['Row'];
type Estudiante = Database['public']['Tables']['estudiantes']['Row'];
type Evaluacion = Database['public']['Tables']['evaluaciones_cotidiano']['Row'];

interface Props {
    periodo: number;
}

export const TrabajoCotidianoPage: React.FC<Props> = ({ periodo }) => {
    const [secciones, setSecciones] = useState<any[]>([]);
    const [selectedSeccion, setSelectedSeccion] = useState<string>('');
    const [trabajos, setTrabajos] = useState<Trabajo[]>([]);
    const [selectedTrabajo, setSelectedTrabajo] = useState<string>('');
    const [indicadores, setIndicadores] = useState<Indicador[]>([]);
    const [estudiantes, setEstudiantes] = useState<Estudiante[]>([]);
    const [evaluaciones, setEvaluaciones] = useState<Record<string, Record<string, number>>>({}); // student_id -> indicador_id -> score
    const [loading, setLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [showManager, setShowManager] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [showSummary, setShowSummary] = useState(false);
    const [allTrabajosTemplates, setAllTrabajosTemplates] = useState<Trabajo[]>([]);
    const { showToast } = useToast();

    // Manager state
    const [editNombre, setEditNombre] = useState('');
    const [editIndicadores, setEditIndicadores] = useState<{ id?: string, titulo: string, d0: string, d1: string, d2: string, d3: string }[]>([]);

    useEffect(() => {
        fetchInitialData();
        fetchAllTrabajosTemplates();
    }, []);

    useEffect(() => {
        if (selectedSeccion) {
            fetchTrabajos(selectedSeccion);
            fetchEstudiantes(selectedSeccion);
        }
    }, [selectedSeccion, periodo]);

    useEffect(() => {
        if (selectedTrabajo) {
            fetchIndicadoresAndEvaluations(selectedTrabajo);
        } else {
            setIndicadores([]);
            setEvaluaciones({});
        }
    }, [selectedTrabajo]);

    async function fetchInitialData() {
        const { data } = await typedSupabase.from('secciones').select('*').order('nombre');
        setSecciones(data || []);
        if (data && data.length > 0 && !selectedSeccion) setSelectedSeccion(data[0].id);
    }

    async function fetchAllTrabajosTemplates() {
        const { data } = await typedSupabase.from('trabajos_cotidianos').select('*').order('created_at', { ascending: false });
        setAllTrabajosTemplates(data || []);
    }

    async function fetchTrabajos(seccionId: string) {
        const { data } = await typedSupabase.from('trabajos_cotidianos').select('*').eq('seccion_id', seccionId).eq('periodo', periodo).order('id');
        setTrabajos(data || []);
        if (data && data.length > 0) setSelectedTrabajo(String(data[0].id));
        else setSelectedTrabajo('');
    }

    async function fetchEstudiantes(seccionId: string) {
        const { data } = await typedSupabase.from('estudiantes').select('*').eq('seccion_id', seccionId).order('apellidos');
        setEstudiantes(data || []);
    }

    async function fetchIndicadoresAndEvaluations(trabajoId: string) {
        setLoading(true);
        // Indicators
        const { data: indData } = await typedSupabase.from('indicadores').select('*').eq('trabajo_id', parseInt(trabajoId)).order('orden'); // Use typedSupabase
        setIndicadores(indData || []);

        // Evaluations
        const indIds = (indData || []).map(i => i.id); // Removed i: any
        const { data: evalData } = await typedSupabase.from('evaluaciones_cotidiano').select('*').in('indicador_id', indIds); // Use typedSupabase

        const evalMap: Record<string, Record<string, number>> = {};
        (evalData || []).forEach(ev => { // Removed ev: any
            if (!evalMap[ev.estudiante_id]) evalMap[ev.estudiante_id] = {};
            evalMap[ev.estudiante_id][ev.indicador_id] = ev.puntaje || 0; // Handle puntaje possibly being null
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

    const calculateNota = (estudianteId: string) => {
        if (indicadores.length === 0) return 0;
        const studentEvals = evaluaciones[estudianteId] || {};
        let points = 0;
        indicadores.forEach(ind => {
            points += studentEvals[ind.id] || 0;
        });
        const maxPoints = indicadores.length * 3;
        return Math.round((points / maxPoints) * 100) || 0;
    };

    const handleToggleAllScores = (estudianteId: string) => {
        setEvaluaciones(prev => {
            const studentEvals = prev[estudianteId] || {};
            // Check if all indicators are already 3
            const allAreThree = indicadores.length > 0 && indicadores.every(ind => studentEvals[ind.id] === 3);
            const newScore = allAreThree ? 0 : 3;

            const updatedStudentEvals = { ...studentEvals };
            indicadores.forEach(ind => {
                updatedStudentEvals[ind.id] = newScore;
            });

            return {
                ...prev,
                [estudianteId]: updatedStudentEvals
            };
        });
    };

    async function saveEvaluations() {
        setIsSaving(true);
        try {
            const upsertData: any[] = [];
            estudiantes.forEach(est => {
                const estEvals = evaluaciones[est.cedula] || {};
                indicadores.forEach(ind => {
                    if (estEvals[ind.id] !== undefined) {
                        upsertData.push({
                            estudiante_id: est.cedula,
                            indicador_id: ind.id,
                            puntaje: estEvals[ind.id]
                        });
                    }
                });
            });

            if (upsertData.length > 0) {
                const { error } = await typedSupabase.from('evaluaciones_cotidiano').upsert(upsertData, { onConflict: 'estudiante_id, indicador_id' });
                if (error) throw error;
            }
            showToast('Evaluaciones guardadas', 'success');
        } catch (error: any) {
            showToast(`Error: ${error.message}`, 'error');
        } finally {
            setIsSaving(false);
        }
    }

    // Manager logic
    const handleNewTrabajo = () => {
        setEditNombre('');
        setEditIndicadores([{ id: undefined, titulo: '', d0: '', d1: '', d2: '', d3: '' }]);
        setIsEditing(false);
        setShowManager(true);
    };

    const handleEditRubrica = async () => {
        if (!selectedTrabajo) return;
        const trabajo = trabajos.find(t => String(t.id) === selectedTrabajo);
        if (!trabajo) return;

        setEditNombre(trabajo.nombre);
        const { data: indData } = await typedSupabase.from('indicadores').select('*').eq('trabajo_id', parseInt(selectedTrabajo)).order('orden');

        if (indData) {
            setEditIndicadores(indData.map(i => ({
                id: i.id,
                titulo: i.titulo,
                d0: i.desc_0 || '',
                d1: i.desc_1 || '',
                d2: i.desc_2 || '',
                d3: i.desc_3 || ''
            })));
        }
        setIsEditing(true);
        setShowManager(true);
    };

    const handleLoadTemplate = async (templateId: string) => {
        if (!templateId) return;
        setLoading(true);
        try {
            const { data: indData } = await typedSupabase.from('indicadores').select('*').eq('trabajo_id', parseInt(templateId)).order('orden');
            if (indData) {
                setEditIndicadores(indData.map(i => ({
                    id: undefined, // Template indicators should NOT have IDs to force new creation
                    titulo: i.titulo,
                    d0: i.desc_0 || '',
                    d1: i.desc_1 || '',
                    d2: i.desc_2 || '',
                    d3: i.desc_3 || ''
                })));
                showToast('Plantilla cargada', 'success');
            }
        } catch (error: any) {
            showToast(`Error: ${error.message}`, 'error');
        } finally {
            setLoading(false);
        }
    };

    const addIndicatorField = () => {
        if (editIndicadores.length < 5) {
            setEditIndicadores([...editIndicadores, { id: undefined, titulo: '', d0: '', d1: '', d2: '', d3: '' }]);
        }
    };

    async function createTrabajo() {
        if (!editNombre) return;
        setLoading(true);
        try {
            if (isEditing && selectedTrabajo) {
                // Update existing work name
                const { error: tcError } = await typedSupabase.from('trabajos_cotidianos').update({
                    nombre: editNombre
                }).eq('id', parseInt(selectedTrabajo));

                if (tcError) throw tcError;

                // Handle indicators (Update existing, Insert new, Delete removed)
                const { data: existingInds } = await typedSupabase.from('indicadores').select('id').eq('trabajo_id', parseInt(selectedTrabajo));
                const existingIds = (existingInds || []).map(i => i.id);
                const keptIds = editIndicadores.map(i => i.id).filter(id => !!id) as string[];

                // Delete removed
                const toDelete = existingIds.filter(id => !keptIds.includes(id));
                if (toDelete.length > 0) {
                    await typedSupabase.from('indicadores').delete().in('id', toDelete);
                }

                // Upsert remaining/new
                for (let idx = 0; idx < editIndicadores.length; idx++) {
                    const ind = editIndicadores[idx];
                    const data: Database['public']['Tables']['indicadores']['Update'] = {
                        trabajo_id: parseInt(selectedTrabajo),
                        titulo: ind.titulo,
                        orden: idx + 1,
                        desc_0: ind.d0, desc_1: ind.d1, desc_2: ind.d2, desc_3: ind.d3
                    };

                    if (ind.id) {
                        await typedSupabase.from('indicadores').update(data).eq('id', ind.id);
                    } else {
                        await typedSupabase.from('indicadores').insert(data as any);
                    }
                }

                showToast('Rúbrica actualizada', 'success');
                fetchIndicadoresAndEvaluations(selectedTrabajo);
                setShowManager(false);
                return;
            } else {
                // Create new
                const { data: trabajo, error: tcError } = await typedSupabase.from('trabajos_cotidianos').insert({
                    nombre: editNombre,
                    seccion_id: selectedSeccion,
                    periodo: periodo
                }).select().single();

                if (tcError) throw tcError;

                const indsData: Database['public']['Tables']['indicadores']['Insert'][] = editIndicadores.map((ind, idx) => ({
                    trabajo_id: trabajo!.id,
                    titulo: ind.titulo,
                    orden: idx + 1,
                    desc_0: ind.d0, desc_1: ind.d1, desc_2: ind.d2, desc_3: ind.d3
                }));

                const { error: indError } = await typedSupabase.from('indicadores').insert(indsData);
                if (indError) throw indError;

                showToast('Trabajo Cotidiano creado', 'success');
                fetchTrabajos(selectedSeccion);
                fetchAllTrabajosTemplates();
            }
            setShowManager(false);
        } catch (error: any) {
            showToast(`Error: ${error.message}`, 'error');
        } finally { setLoading(false); }
    }

    return (
        <div className="cotidiano-page">
            <header style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <div>
                    <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>Trabajo Cotidiano</h1>
                    <p style={{ color: 'var(--text-muted)' }}>Evaluación por rúbrica analítica y descriptores.</p>
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
                    <button onClick={handleNewTrabajo} className="btn-primary" style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid var(--glass-border)' }}>
                        ➕ Nuevo Trabajo
                    </button>
                </div>
            </header>

            {!showManager ? (
                <div className="evaluation-view">
                    <div className="glass-card" style={{ padding: '1.5rem', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            <label style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Trabajo:</label>
                            <select
                                value={selectedTrabajo}
                                onChange={e => setSelectedTrabajo(e.target.value)}
                                className="glass-card"
                                style={{ padding: '0.5rem 1rem', background: 'rgba(255,255,255,0.05)', color: 'white', border: 'none' }}
                            >
                                {trabajos.map(t => <option key={t.id} value={t.id} style={{ background: '#1e1b4b' }}>{t.nombre}</option>)}
                                {trabajos.length === 0 && <option value="">No hay trabajos creados</option>}
                            </select>
                        </div>
                        <div style={{ display: 'flex', gap: '1rem' }}>
                            <button
                                onClick={saveEvaluations}
                                disabled={isSaving || !selectedTrabajo}
                                className="btn-primary"
                                style={{ background: 'var(--primary)', opacity: selectedTrabajo ? 1 : 0.5 }}
                            >
                                {isSaving ? '⌛ Guardando...' : '💾 Guardar Notas'}
                            </button>
                            {selectedTrabajo && (
                                <>
                                    <button
                                        onClick={handleEditRubrica}
                                        className="btn-primary"
                                        style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid var(--glass-border)' }}
                                    >
                                        📝 Editar Rúbrica
                                    </button>
                                    <button
                                        onClick={async () => {
                                            if (confirm('¿Estás seguro de eliminar este trabajo cotidiano y todas sus notas?')) {
                                                const { error } = await supabase.from('trabajos_cotidianos').delete().eq('id', parseInt(selectedTrabajo));
                                                if (error) {
                                                    showToast(`Error al eliminar: ${error.message}`, 'error');
                                                } else {
                                                    showToast('Trabajo eliminado correctamente', 'success');
                                                    fetchTrabajos(selectedSeccion);
                                                }
                                            }
                                        }}
                                        className="btn-primary"
                                        style={{ background: 'var(--danger)', opacity: 0.8 }}
                                    >
                                        🗑️ Eliminar
                                    </button>
                                </>
                            )}
                        </div>
                    </div>

                    {selectedTrabajo && (
                        <div className="glass-card" style={{ overflowX: 'auto', padding: '0' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--glass-border)' }}>
                                        <th style={{ textAlign: 'left', padding: '1rem 1.5rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>Estudiante</th>
                                        <th style={{ textAlign: 'center', padding: '1rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>All</th>
                                        {indicadores.map((ind, idx) => (
                                            <th key={ind.id} style={{ textAlign: 'center', padding: '1rem', fontSize: '0.7rem', maxWidth: '120px' }} title={ind.titulo}>
                                                I{idx + 1}
                                                <div style={{ fontSize: '0.6rem', fontWeight: 400, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                    {ind.titulo}
                                                </div>
                                            </th>
                                        ))}
                                        <th style={{ textAlign: 'center', padding: '1rem', fontSize: '0.8rem', color: 'var(--primary)', fontWeight: 700 }}>NOTA</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {estudiantes.map(est => {
                                        const initials = `${est.nombre.charAt(0)}${est.apellidos.charAt(0)}`.toUpperCase();
                                        const nota = calculateNota(est.cedula);
                                        return (
                                            <tr key={est.cedula} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                                <td style={{ padding: '1rem 1.5rem' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                        <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem' }}>{initials}</div>
                                                        <div style={{ fontSize: '0.9rem' }}>{est.nombre} {est.apellidos}</div>
                                                    </div>
                                                </td>
                                                <td style={{ textAlign: 'center' }}>
                                                    {(() => {
                                                        const studentEvals = evaluaciones[est.cedula] || {};
                                                        const allAreThree = indicadores.length > 0 && indicadores.every(ind => studentEvals[ind.id] === 3);
                                                        return (
                                                            <button
                                                                onClick={() => handleToggleAllScores(est.cedula)}
                                                                style={{
                                                                    fontSize: '9px',
                                                                    padding: '4px 8px',
                                                                    borderRadius: '8px',
                                                                    background: allAreThree ? 'var(--danger)' : 'var(--primary)',
                                                                    color: 'white',
                                                                    border: 'none',
                                                                    cursor: 'pointer',
                                                                    fontWeight: 'bold',
                                                                    transition: 'all 0.2s'
                                                                }}
                                                            >
                                                                {allAreThree ? 'CERO' : 'MAX'}
                                                            </button>
                                                        );
                                                    })()}
                                                </td>
                                                {indicadores.map(ind => {
                                                    const score = evaluaciones[est.cedula]?.[ind.id] ?? null;
                                                    return (
                                                        <td key={ind.id} style={{ textAlign: 'center', padding: '0.5rem' }}>
                                                            <div style={{ display: 'flex', gap: '2px', justifyContent: 'center' }}>
                                                                {[0, 1, 2, 3].map(s => (
                                                                    <button
                                                                        key={s}
                                                                        onClick={() => handleScoreClick(est.cedula, ind.id, s)}
                                                                        title={s === 0 ? (ind.desc_0 ?? '') : s === 1 ? (ind.desc_1 ?? '') : s === 2 ? (ind.desc_2 ?? '') : (ind.desc_3 ?? '')}
                                                                        style={{
                                                                            width: '24px', height: '24px', borderRadius: '4px', border: 'none',
                                                                            background: score === s ? 'var(--primary)' : 'rgba(255,255,255,0.05)',
                                                                            color: 'white', fontSize: '10px', cursor: 'pointer', transition: 'all 0.2s'
                                                                        }}
                                                                    >
                                                                        {s}
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        </td>
                                                    );
                                                })}
                                                <td style={{ textAlign: 'center', fontWeight: 700, color: nota >= 70 ? 'var(--primary)' : 'var(--danger)' }}>
                                                    {nota}
                                                </td>
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
                        <h2>{isEditing ? 'Editar Rúbrica de Trabajo Cotidiano' : 'Configurar Rúbrica de Trabajo Cotidiano'}</h2>
                        <button onClick={() => setShowManager(false)} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}>✕ Cancelar</button>
                    </div>

                    {!isEditing && (
                        <div style={{ marginBottom: '2rem' }}>
                            <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Opcional: Cargar indicadores de otro trabajo</label>
                            <select
                                onChange={e => handleLoadTemplate(e.target.value)}
                                className="glass-card"
                                style={{ width: '100%', padding: '0.75rem', background: 'rgba(255,255,255,0.05)', color: 'white', border: 'none' }}
                            >
                                <option value="">-- Seleccionar trabajo como plantilla --</option>
                                {allTrabajosTemplates.map(t => (
                                    <option key={t.id} value={t.id} style={{ background: '#1e1b4b' }}>
                                        {t.nombre} ({new Date(t.created_at || '').toLocaleDateString()})
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    <div style={{ marginBottom: '2rem' }}>
                        <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Nombre del Trabajo (ej. TC1 - Funciones Lógicas)</label>
                        <input
                            type="text"
                            value={editNombre}
                            onChange={e => setEditNombre(e.target.value)}
                            className="glass-card"
                            style={{ width: '100%', padding: '1rem', background: 'rgba(255,255,255,0.05)', color: 'white', border: 'none' }}
                            placeholder="Nombre descriptivo..."
                        />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                        {editIndicadores.map((ind, idx) => (
                            <div key={idx} className="glass-card" style={{ padding: '1.5rem', background: 'rgba(255,255,255,0.02)' }}>
                                <div style={{ marginBottom: '1rem', fontWeight: 600, color: 'var(--primary)' }}>Indicador I{idx + 1}</div>
                                <input
                                    type="text"
                                    placeholder="Título del indicador..."
                                    value={ind.titulo}
                                    onChange={e => {
                                        const newInds = [...editIndicadores];
                                        newInds[idx].titulo = e.target.value;
                                        setEditIndicadores(newInds);
                                    }}
                                    className="glass-card"
                                    style={{ width: '100%', padding: '0.75rem', marginBottom: '1rem', background: 'rgba(255,255,255,0.05)', color: 'white', border: 'none' }}
                                />
                                <div className="grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
                                    <div>
                                        <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>0 - No presenta evidencia</label>
                                        <textarea value={ind.d0} onChange={e => { const n = [...editIndicadores]; n[idx].d0 = e.target.value; setEditIndicadores(n); }} className="glass-card" style={{ width: '100%', height: '60px', padding: '0.5rem', background: 'rgba(255,255,255,0.02)', color: 'white', border: 'none', fontSize: '0.8rem' }} />
                                    </div>
                                    <div>
                                        <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>1 - Aún no logrado (Reconoce...)</label>
                                        <textarea value={ind.d1} onChange={e => { const n = [...editIndicadores]; n[idx].d1 = e.target.value; setEditIndicadores(n); }} className="glass-card" style={{ width: '100%', height: '60px', padding: '0.5rem', background: 'rgba(255,255,255,0.02)', color: 'white', border: 'none', fontSize: '0.8rem' }} />
                                    </div>
                                    <div>
                                        <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>2 - En proceso (Infiere...)</label>
                                        <textarea value={ind.d2} onChange={e => { const n = [...editIndicadores]; n[idx].d2 = e.target.value; setEditIndicadores(n); }} className="glass-card" style={{ width: '100%', height: '60px', padding: '0.5rem', background: 'rgba(255,255,255,0.02)', color: 'white', border: 'none', fontSize: '0.8rem' }} />
                                    </div>
                                    <div>
                                        <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>3 - Logrado (Aplica...)</label>
                                        <textarea value={ind.d3} onChange={e => { const n = [...editIndicadores]; n[idx].d3 = e.target.value; setEditIndicadores(n); }} className="glass-card" style={{ width: '100%', height: '60px', padding: '0.5rem', background: 'rgba(255,255,255,0.02)', color: 'white', border: 'none', fontSize: '0.8rem' }} />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div style={{ marginTop: '2rem', display: 'flex', gap: '1rem' }}>
                        {editIndicadores.length < 5 && (
                            <button onClick={addIndicatorField} className="btn-primary" style={{ background: 'rgba(255,255,255,0.1)' }}>
                                ➕ Añadir Indicador
                            </button>
                        )}
                        <button onClick={createTrabajo} disabled={loading} className="btn-primary">
                            {loading ? '⌛ Guardando...' : (isEditing ? '✅ Guardar Cambios' : '✅ Finalizar y Crear Rúbrica')}
                        </button>
                    </div>
                </div>
            )
            }

            {
                showSummary && selectedSeccion && (
                    <CotidianoSummary
                        seccionId={selectedSeccion}
                        periodo={periodo}
                        onClose={() => setShowSummary(false)}
                    />
                )
            }
        </div >
    );
};
