import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Database } from '../types/database';
import { useToast } from './Toast';
import { ExamenSummary } from './ExamenSummary';
import { SupabaseClient } from '@supabase/supabase-js';

const typedSupabase = supabase as SupabaseClient<Database>;

type Examen = Database['public']['Tables']['examenes']['Row'];
type IndicadorExamen = Database['public']['Tables']['indicadores_examen']['Row'];
type Estudiante = Database['public']['Tables']['estudiantes']['Row'];
type EvaluacionExamen = Database['public']['Tables']['evaluaciones_examen']['Row'];

interface Props {
    periodo: number;
}

export const ExamenesPage: React.FC<Props> = ({ periodo }) => {
    const [secciones, setSecciones] = useState<Database['public']['Tables']['secciones']['Row'][]>([]);
    const [selectedSeccion, setSelectedSeccion] = useState<string>('');
    const [examenes, setExamenes] = useState<Examen[]>([]);
    const [selectedExamen, setSelectedExamen] = useState<string>('');
    const [indicadores, setIndicadores] = useState<IndicadorExamen[]>([]);
    const [estudiantes, setEstudiantes] = useState<Estudiante[]>([]);
    const [evaluaciones, setEvaluaciones] = useState<Record<string, Record<string, number>>>({});
    const [notasDirectas, setNotasDirectas] = useState<Record<string, number | ''>>({});
    const [loading, setLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [showManager, setShowManager] = useState(false);
    const [showSummary, setShowSummary] = useState(false);
    const [allExamenesTemplates, setAllExamenesTemplates] = useState<Examen[]>([]);
    const { showToast } = useToast();

    // Manager state
    const [editNombre, setEditNombre] = useState('');
    const [editPorcentaje, setEditPorcentaje] = useState<number>(25);
    const [editPuntosTotales, setEditPuntosTotales] = useState<number>(30);
    const [editIndicadores, setEditIndicadores] = useState<{ titulo: string, d0: string, d1: string, d2: string, d3: string }[]>([]);

    useEffect(() => {
        fetchInitialData();
        fetchAllExamenesTemplates();
    }, []);

    async function fetchAllExamenesTemplates() {
        const { data } = await typedSupabase.from('examenes').select('*').order('id', { ascending: false });
        setAllExamenesTemplates(data || []);
    }

    useEffect(() => {
        if (selectedSeccion) {
            fetchExamenes(selectedSeccion);
            fetchEstudiantes(selectedSeccion);
        }
    }, [selectedSeccion, periodo]);

    useEffect(() => {
        if (selectedExamen) {
            fetchIndicadoresAndEvaluations(selectedExamen);
        } else {
            setIndicadores([]);
            setEvaluaciones({});
            setNotasDirectas({});
        }
    }, [selectedExamen]);

    async function fetchInitialData() {
        const { data } = await typedSupabase.from('secciones').select('*').order('nombre');
        setSecciones(data || []);
        if (data && data.length > 0) setSelectedSeccion(data[0].id);
    }

    async function fetchExamenes(seccionId: string) {
        const { data } = await typedSupabase.from('examenes').select('*').eq('seccion_id', seccionId).eq('periodo', periodo).order('id');
        setExamenes(data || []);
        if (data && data.length > 0) setSelectedExamen(String(data[0].id));
        else setSelectedExamen('');
    }

    async function fetchEstudiantes(seccionId: string) {
        const { data } = await typedSupabase.from('estudiantes').select('*').eq('seccion_id', seccionId).order('apellidos');
        setEstudiantes(data || []);
    }

    async function fetchIndicadoresAndEvaluations(examenId: string) {
        setLoading(true);
        const { data: indData } = await typedSupabase.from('indicadores_examen').select('*').eq('examen_id', parseInt(examenId)).order('orden');
        setIndicadores(indData || []);

        const indIds = (indData || []).map(i => i.id);
        const { data: evalData } = await typedSupabase.from('evaluaciones_examen').select('*').in('indicador_id', indIds);

        const evalMap: Record<string, Record<string, number>> = {};
        (evalData || []).forEach(ev => {
            if (!evalMap[ev.estudiante_id]) evalMap[ev.estudiante_id] = {};
            evalMap[ev.estudiante_id][ev.indicador_id] = ev.puntaje || 0;
        });
        setEvaluaciones(evalMap);

        const { data: directData } = await (typedSupabase as any).from('notas_directas_examen').select('*').eq('examen_id', parseInt(examenId));
        const ndMap: Record<string, number> = {};
        (directData as any[] || []).forEach(nd => {
            ndMap[nd.estudiante_id] = nd.nota;
        });
        setNotasDirectas(ndMap);

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
        // Limpiar nota directa si se edita un indicador
        setNotasDirectas(prev => {
            const updated = { ...prev };
            delete updated[estudianteId];
            return updated;
        });
    };

    const handleScoreChange = (estudianteId: string, indicadorId: string | number, value: string) => {
        if (value === '') {
            setEvaluaciones(prev => {
                const updated = { ...prev };
                if (updated[estudianteId]) {
                    const student = { ...updated[estudianteId] };
                    delete student[indicadorId];
                    updated[estudianteId] = student;
                }
                return updated;
            });
        } else {
            let val = parseInt(value);
            if (isNaN(val)) val = 0;
            if (val > 3) val = 3;
            if (val < 0) val = 0;
            handleScoreClick(estudianteId, String(indicadorId), val);
        }
    };

    const handleNotaFinalDirecta = (estudianteId: string, value: string) => {
        if (value === '') {
            setNotasDirectas(prev => {
                const updated = { ...prev };
                delete updated[estudianteId];
                return updated;
            });
            return;
        }
        let num = Number(value);
        if (isNaN(num)) return;
        if (num > 100) num = 100;
        if (num < 0) num = 0;
        setNotasDirectas(prev => ({ ...prev, [estudianteId]: num }));
        
        // Set all indicators to 0
        setEvaluaciones(prev => {
            const updated = { ...prev };
            const zeroed: Record<string, number> = {};
            indicadores.forEach(ind => {
                zeroed[ind.id] = 0;
            });
            updated[estudianteId] = zeroed;
            return updated;
        });
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
        // Limpiar nota directa si se usa MAX/MIN
        setNotasDirectas(prev => {
            const updated = { ...prev };
            delete updated[estudianteId];
            return updated;
        });
    };

    const calculateGrades = (estudianteId: string) => {
        const currentExamen = examenes.find(e => String(e.id) === selectedExamen);
        if (!currentExamen || indicadores.length === 0) return { nota: 0, obtenido: 0 };

        const directGrade = notasDirectas[estudianteId];
        if (directGrade !== undefined && directGrade !== '') {
            const nota = Number(directGrade);
            const obtenido = Number(((nota / 100) * currentExamen.porcentaje).toFixed(2));
            return { nota, obtenido };
        }

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
            const upsertData: Database['public']['Tables']['evaluaciones_examen']['Insert'][] = [];
            const directNotesUpsert: any[] = [];
            const directNotesDelete: string[] = [];

            estudiantes.forEach(est => {
                const directGrade = notasDirectas[est.cedula];
                if (directGrade !== undefined && directGrade !== '') {
                    // Has direct note
                    directNotesUpsert.push({
                        examen_id: parseInt(selectedExamen),
                        estudiante_id: est.cedula,
                        nota: Number(directGrade)
                    });
                } else {
                    // Has indicators
                    directNotesDelete.push(est.cedula);
                    const estEvals = evaluaciones[est.cedula] || {};
                    indicadores.forEach(ind => {
                        if (estEvals[ind.id] !== undefined) {
                            upsertData.push({ estudiante_id: est.cedula, indicador_id: ind.id, puntaje: estEvals[ind.id] });
                        }
                    });
                }
            });

            if (upsertData.length > 0) {
                const { error } = await typedSupabase.from('evaluaciones_examen').upsert(upsertData, { onConflict: 'estudiante_id, indicador_id' });
                if (error) throw error;
            }

            if (directNotesUpsert.length > 0) {
                const { error } = await (typedSupabase as any).from('notas_directas_examen').upsert(directNotesUpsert, { onConflict: 'examen_id, estudiante_id' });
                if (error) throw error;
            }

            if (directNotesDelete.length > 0) {
                const { error } = await (typedSupabase as any).from('notas_directas_examen')
                    .delete()
                    .eq('examen_id', parseInt(selectedExamen))
                    .in('estudiante_id', directNotesDelete);
                if (error) throw error;
            }

            showToast('Evaluaciones de examen guardadas', 'success');
        } catch (error: any) {
            showToast(`Error: ${error.message}`, 'error');
        } finally { setIsSaving(false); }
    }

    const handleLoadTemplate = async (templateId: string) => {
        if (!templateId) return;
        setLoading(true);
        try {
            const template = allExamenesTemplates.find(t => String(t.id) === templateId);
            if (template) {
                setEditNombre(template.nombre);
                setEditPorcentaje(template.porcentaje);
                setEditPuntosTotales(template.puntos_totales);
            }
            
            const { data: indData } = await typedSupabase.from('indicadores_examen').select('*').eq('examen_id', parseInt(templateId)).order('orden');
            if (indData) {
                setEditIndicadores(indData.map(i => ({
                    titulo: i.titulo,
                    d0: i.desc_0 || '',
                    d1: i.desc_1 || '',
                    d2: i.desc_2 || '',
                    d3: i.desc_3 || ''
                })));
                showToast('Plantilla de examen cargada', 'success');
            }
        } catch (error: any) {
            showToast(`Error: ${error.message}`, 'error');
        } finally {
            setLoading(false);
        }
    };

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
            const { data: examen, error: eError } = await typedSupabase.from('examenes').insert({
                nombre: editNombre,
                seccion_id: selectedSeccion,
                porcentaje: editPorcentaje,
                puntos_totales: editPuntosTotales,
                periodo: periodo
            }).select().single();

            if (eError) throw eError;

            const indsData: Database['public']['Tables']['indicadores_examen']['Insert'][] = editIndicadores.map((ind, idx) => ({
                examen_id: examen!.id,
                titulo: ind.titulo,
                orden: idx + 1,
                desc_0: ind.d0, desc_1: ind.d1, desc_2: ind.d2, desc_3: ind.d3
            }));

            const { error: indError } = await typedSupabase.from('indicadores_examen').insert(indsData);
            if (indError) throw indError;

            showToast('Examen configurado correctamente', 'success');
            setShowManager(false);
            fetchExamenes(selectedSeccion);
            fetchAllExamenesTemplates();
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
                    <div className="glass-card" style={{ padding: '2rem', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                <label style={{ fontSize: '1rem', fontWeight: 'bold', color: 'var(--primary)' }}>CALIFICAR:</label>
                                <select
                                    value={selectedExamen}
                                    onChange={e => setSelectedExamen(e.target.value)}
                                    className="glass-card"
                                    style={{
                                        padding: '0.8rem 1.5rem',
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
                                <div style={{ display: 'flex', gap: '1.5rem', fontSize: '1rem' }}>
                                    <div style={{ color: 'var(--primary)', background: 'rgba(255,255,255,0.05)', padding: '0.5rem 1rem', borderRadius: '8px' }}><strong>Puntos Totales:</strong> {examenes.find(e => String(e.id) === selectedExamen)?.puntos_totales}</div>
                                    <div style={{ color: 'var(--primary)', background: 'rgba(255,255,255,0.05)', padding: '0.5rem 1rem', borderRadius: '8px' }}><strong>Valor:</strong> {examenes.find(e => String(e.id) === selectedExamen)?.porcentaje}%</div>
                                </div>
                            )}
                        </div>
                        <div style={{ display: 'flex', gap: '1rem' }}>
                            <button onClick={saveEvaluations} disabled={isSaving || !selectedExamen} className="btn-primary" style={{ padding: '0.8rem 2rem', fontSize: '1.1rem', fontWeight: 'bold' }}>
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
                                    style={{ background: 'var(--danger)', opacity: 0.8, padding: '0.8rem 1.5rem', fontSize: '1rem' }}
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
                                        <th style={{ textAlign: 'left', padding: '0.75rem 1rem', fontSize: '0.8rem', color: 'var(--text-muted)', position: 'sticky', left: 0, zIndex: 10, background: '#111827', minWidth: '200px' }}>Estudiante</th>
                                        <th style={{ textAlign: 'center', padding: '0.5rem', fontSize: '0.7rem', color: 'var(--text-muted)' }}>M/M</th>
                                        {indicadores.map((ind, idx) => (
                                            <th key={ind.id} style={{ textAlign: 'center', padding: '0.5rem 0.2rem', fontSize: '0.7rem', width: '45px', minWidth: '45px', maxWidth: '45px' }} title={ind.titulo}>
                                                I{idx + 1}
                                                <div style={{ fontSize: '0.55rem', fontWeight: 400, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '40px' }}>{ind.titulo}</div>
                                            </th>
                                        ))}
                                        <th style={{ textAlign: 'center', padding: '0.5rem', fontSize: '0.7rem', color: '#facc15', fontWeight: 700 }}>NOTA FINAL</th>
                                        <th style={{ textAlign: 'center', padding: '0.5rem', fontSize: '0.75rem', color: 'var(--primary)', fontWeight: 700 }}>CALIF.</th>
                                        <th style={{ textAlign: 'center', padding: '0.5rem', fontSize: '0.75rem', color: 'var(--primary)', fontWeight: 700 }}>%</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {estudiantes.map(est => {
                                        const { nota, obtenido } = calculateGrades(est.cedula);
                                        const studentEvals = evaluaciones[est.cedula] || {};
                                        const allAreThree = indicadores.length > 0 && indicadores.every(ind => studentEvals[ind.id] === 3);
                                        const notaDirecta = notasDirectas[est.cedula] ?? '';
                                        const tieneNotaDirecta = notaDirecta !== '';
                                        
                                        return (
                                            <tr key={est.cedula} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: tieneNotaDirecta ? 'rgba(250,204,21,0.03)' : 'transparent' }}>
                                                <td style={{ padding: '0.75rem 1rem', fontSize: '0.85rem', position: 'sticky', left: 0, zIndex: 5, background: tieneNotaDirecta ? '#1a180e' : '#111827', whiteSpace: 'nowrap', borderRight: '1px solid rgba(255,255,255,0.05)' }}>{est.apellidos}, {est.nombre}</td>
                                                <td style={{ textAlign: 'center', padding: '0.25rem' }}>
                                                    <button onClick={() => handleToggleAllScores(est.cedula)} style={{ fontSize: '8px', padding: '4px 6px', borderRadius: '6px', background: allAreThree ? 'var(--danger)' : 'var(--primary)', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>{allAreThree ? 'MIN' : 'MAX'}</button>
                                                </td>
                                                {indicadores.map(ind => {
                                                    const score = evaluaciones[est.cedula]?.[String(ind.id)];
                                                    const displayScore = score !== undefined ? score : '';
                                                    return (
                                                        <td key={ind.id} style={{ textAlign: 'center', padding: '0.25rem' }}>
                                                            <input
                                                                type="number"
                                                                min={0}
                                                                max={3}
                                                                value={displayScore}
                                                                onChange={e => handleScoreChange(est.cedula, ind.id, e.target.value)}
                                                                title={`${ind.titulo} (0-3)`}
                                                                style={{
                                                                    width: '38px',
                                                                    textAlign: 'center',
                                                                    background: 'rgba(255,255,255,0.07)',
                                                                    border: '1px solid rgba(99,102,241,0.3)',
                                                                    borderRadius: '6px',
                                                                    color: 'white',
                                                                    fontSize: '0.85rem',
                                                                    fontWeight: 700,
                                                                    padding: '4px 0',
                                                                    outline: 'none'
                                                                }}
                                                            />
                                                        </td>
                                                    );
                                                })}
                                                <td style={{ textAlign: 'center', padding: '0.25rem' }}>
                                                    <input
                                                        type="number"
                                                        min={0}
                                                        max={100}
                                                        placeholder="—"
                                                        value={notasDirectas[est.cedula] ?? ''}
                                                        onChange={e => handleNotaFinalDirecta(est.cedula, e.target.value)}
                                                        title="Nota Final Directa (sobreescribe rúbrica)"
                                                        style={{
                                                            width: '46px',
                                                            textAlign: 'center',
                                                            background: tieneNotaDirecta ? 'rgba(250,204,21,0.15)' : 'rgba(255,255,255,0.05)',
                                                            border: `1px solid ${tieneNotaDirecta ? '#facc15' : 'rgba(255,255,255,0.1)'}`,
                                                            borderRadius: '6px',
                                                            color: tieneNotaDirecta ? '#facc15' : 'var(--text-muted)',
                                                            fontSize: '0.85rem',
                                                            fontWeight: 700,
                                                            padding: '4px 0',
                                                            outline: 'none'
                                                        }}
                                                    />
                                                </td>
                                                <td style={{ textAlign: 'center', fontWeight: 700, color: nota >= 70 ? 'var(--primary)' : 'var(--danger)', fontSize: '0.85rem' }}>{obtenido}%</td>
                                                <td style={{ textAlign: 'center', fontWeight: 700, color: nota >= 70 ? 'var(--primary)' : 'var(--danger)', fontSize: '0.85rem' }}>{nota}%</td>
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

                    <div style={{ marginBottom: '2rem' }}>
                        <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Opcional: Cargar indicadores y formato de otro examen (Plantilla)</label>
                        <select
                            onChange={e => handleLoadTemplate(e.target.value)}
                            className="glass-card"
                            style={{ width: '100%', padding: '0.75rem', background: 'rgba(255,255,255,0.05)', color: 'white', border: 'none' }}
                        >
                            <option value="">-- Seleccionar examen como plantilla --</option>
                            {allExamenesTemplates.map(t => (
                                <option key={t.id} value={t.id} style={{ background: '#1e1b4b' }}>
                                    {t.nombre} ({t.porcentaje}%) - {t.puntos_totales} pts
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.5rem', marginBottom: '2rem' }}>
                        <div style={{ gridColumn: 'span 2' }}>
                            <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Nombre del Examen</label>
                            <input type="text" value={editNombre} onChange={e => setEditNombre(e.target.value)} className="glass-card" style={{ width: '100%', padding: '1rem', background: 'rgba(255,255,255,0.05)', color: 'white', border: 'none', fontSize: '1.1rem' }} placeholder="Ej: Primer Examen Trimestral" />
                        </div>
                        <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Valor Porcentual (%)</label>
                            <input type="number" step="0.5" value={editPorcentaje} onChange={e => {
                                let val = parseFloat(e.target.value);
                                if (val > 100) val = 100;
                                if (val < 0) val = 0;
                                setEditPorcentaje(val);
                            }} className="glass-card" style={{ width: '100%', padding: '1rem', fontSize: '1.2rem', fontWeight: 'bold', textAlign: 'center', background: 'rgba(255,255,255,0.05)', color: 'white', border: '2px solid var(--primary)' }} />
                        </div>
                        <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Puntos Totales</label>
                            <input type="number" value={editPuntosTotales} onChange={e => {
                                let val = parseInt(e.target.value);
                                if (val < 1) val = 1;
                                setEditPuntosTotales(val);
                            }} className="glass-card" style={{ width: '100%', padding: '1rem', fontSize: '1.2rem', fontWeight: 'bold', textAlign: 'center', background: 'rgba(255,255,255,0.05)', color: 'white', border: '2px solid var(--primary)' }} />
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
                        {editIndicadores.length < 12 && <button onClick={() => setEditIndicadores([...editIndicadores, { titulo: '', d0: '', d1: '', d2: '', d3: '' }])} className="btn-primary" style={{ background: 'rgba(255,255,255,0.1)' }}>➕ Añadir Indicador</button>}
                        <button onClick={createExamen} disabled={loading} className="btn-primary">{loading ? '⌛ Guardando...' : '✅ Finalizar Configuración'}</button>
                    </div>
                </div>
            )}

            {showSummary && selectedSeccion && (
                <ExamenSummary
                    seccionId={selectedSeccion}
                    periodo={periodo}
                    onClose={() => setShowSummary(false)}
                />
            )}
        </div>
    );
};
