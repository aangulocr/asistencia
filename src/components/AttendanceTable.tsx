import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Database } from '../types/database';
import { useToast } from './Toast';

type Estudiante = Database['public']['Tables']['estudiantes']['Row'];
type Estado = Database['public']['Tables']['estados_asistencia']['Row'];

interface Props {
    seccionId: string;
    fecha: string;
    periodo: number;
    onSave?: () => void;
}

type LessonStatus = 'P' | 'A' | 'T' | 'J';

export function AttendanceTable({ seccionId, fecha, periodo, onSave }: Props) {
    const [estudiantes, setEstudiantes] = useState<Estudiante[]>([]);
    const [asistencias, setAsistencias] = useState<Record<string, LessonStatus[]>>({});
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [leccionesTotales, setLeccionesTotales] = useState<number>(4);
    const [observaciones, setObservaciones] = useState<string>('');
    const { showToast } = useToast();

    const lessonColors: Record<LessonStatus, string> = {
        P: '#22c55e',
        A: '#ef4444',
        T: '#f59e0b',
        J: '#3b82f6'
    };

    const mapStateToLessons = (stateId: number): LessonStatus[] => {
        switch (stateId) {
            // ── Estados originales ──────────────────────────────────
            case 1:  return ['P', 'P', 'P', 'P'];
            case 2:  return ['A', 'A', 'A', 'A'];
            case 3:  return ['A', 'P', 'P', 'P'];  // Ausencia L1
            case 4:  return ['A', 'A', 'P', 'P'];  // Ausencia L1+L2
            case 5:  return ['A', 'A', 'A', 'P'];  // Ausencia L1+L2+L3
            case 6:  return ['T', 'P', 'P', 'P'];  // Tardía L1
            case 7:  return ['P', 'P', 'T', 'P'];  // Tardía L3
            case 8:  return ['A', 'T', 'P', 'P'];  // Ausencia L1 + Tardía L2
            case 9:  return ['A', 'A', 'T', 'P'];  // Ausencia L1+L2 + Tardía L3
            case 10: return ['A', 'A', 'A', 'T'];  // Ausencia L1+L2+L3 + Tardía L4
            case 11: return ['P', 'A', 'P', 'P'];  // Escape/Ausencia L2
            case 12: return ['J', 'J', 'J', 'J'];  // Justificación total
            // ── Ausencias individuales adicionales ──────────────────
            case 13: return ['P', 'A', 'P', 'P'];  // Ausencia L2
            case 14: return ['P', 'P', 'A', 'P'];  // Ausencia L3
            case 15: return ['P', 'P', 'P', 'A'];  // Ausencia L4
            case 16: return ['P', 'A', 'A', 'P'];  // Ausencia L2+L3
            case 17: return ['P', 'P', 'A', 'A'];  // Ausencia L3+L4
            case 18: return ['P', 'A', 'A', 'A'];  // Ausencia L2+L3+L4
            case 19: return ['A', 'P', 'A', 'P'];  // Ausencia L1+L3
            case 20: return ['A', 'P', 'P', 'A'];  // Ausencia L1+L4
            case 36: return ['P', 'A', 'P', 'A'];  // Ausencia L2+L4
            // ── Justificaciones parciales ───────────────────────────
            case 22: return ['J', 'P', 'P', 'P'];  // Justificación L1
            case 23: return ['P', 'J', 'P', 'P'];  // Justificación L2
            case 24: return ['P', 'P', 'J', 'P'];  // Justificación L3
            case 25: return ['P', 'P', 'P', 'J'];  // Justificación L4
            case 26: return ['J', 'J', 'P', 'P'];  // Justificación L1+L2
            case 27: return ['P', 'J', 'J', 'P'];  // Justificación L2+L3
            case 28: return ['P', 'P', 'J', 'J'];  // Justificación L3+L4
            case 29: return ['J', 'J', 'J', 'P'];  // Justificación L1+L2+L3
            case 30: return ['P', 'J', 'J', 'J'];  // Justificación L2+L3+L4
            case 31: return ['J', 'P', 'J', 'P'];  // Justificación L1+L3
            case 32: return ['J', 'P', 'P', 'J'];  // Justificación L1+L4
            case 33: return ['P', 'J', 'P', 'J'];  // Justificación L2+L4
            case 34: return ['J', 'J', 'P', 'J'];  // Justificación L1+L2+L4
            case 35: return ['J', 'P', 'J', 'J'];  // Justificación L1+L3+L4
            default: return ['P', 'P', 'P', 'P'];
        }
    };

    const mapLessonsToState = (lessons: LessonStatus[]): number => {
        const s = lessons.join('');
        // ── Estados originales ────────────────────────────────────
        if (s === 'PPPP') return 1;
        if (s === 'AAAA') return 2;
        if (s === 'APPP') return 3;
        if (s === 'AAPP') return 4;
        if (s === 'AAAP') return 5;
        if (s === 'TPPP') return 6;
        if (s === 'PPTP') return 7;
        if (s === 'ATPP') return 8;
        if (s === 'AATP') return 9;
        if (s === 'AAAT') return 10;
        if (s === 'PAPP') return 11; // Escape L2 (estado original)
        if (s === 'JJJJ') return 12;
        // ── Ausencias individuales adicionales ────────────────────
        if (s === 'PPAP') return 14; // Ausencia L3
        if (s === 'PPPA') return 15; // Ausencia L4
        if (s === 'PAAP') return 16; // Ausencia L2+L3
        if (s === 'PPAA') return 17; // Ausencia L3+L4
        if (s === 'PAAA') return 18; // Ausencia L2+L3+L4
        if (s === 'APAP') return 19; // Ausencia L1+L3
        if (s === 'APPA') return 20; // Ausencia L1+L4
        if (s === 'PAPA') return 36; // Ausencia L2+L4
        // ── Justificaciones parciales ─────────────────────────────
        if (s === 'JPPP') return 22;
        if (s === 'PJPP') return 23;
        if (s === 'PPJP') return 24;
        if (s === 'PPPJ') return 25;
        if (s === 'JJPP') return 26;
        if (s === 'PJJP') return 27;
        if (s === 'PPJJ') return 28;
        if (s === 'JJJP') return 29;
        if (s === 'PJJJ') return 30;
        if (s === 'JPJP') return 31;
        if (s === 'JPPJ') return 32;
        if (s === 'PJPJ') return 33;
        if (s === 'JJPJ') return 34;
        if (s === 'JPJJ') return 35;
        // ── Fallback seguro ───────────────────────────────────────
        return 1;
    };

    useEffect(() => {
        loadData();
    }, [seccionId, fecha, periodo]);

    async function loadData() {
        setLoading(true);
        try {
            // 1. Load configuration (lessons per day)
            const { data: configDataRaw } = await supabase
                .from('configuracion_diaria')
                .select('*')
                .eq('seccion_id', seccionId)
                .eq('fecha', fecha)
                .eq('periodo', periodo)
                .maybeSingle();

            const configData = configDataRaw as Database['public']['Tables']['configuracion_diaria']['Row'] | null;

            if (configData) {
                setLeccionesTotales(configData.lecciones_totales);
                setObservaciones(configData.observaciones || '');
            } else {
                setLeccionesTotales(4);
                setObservaciones('');
            }

            // 2. Load students
            const { data: studentsData } = await supabase
                .from('estudiantes')
                .select('*')
                .eq('seccion_id', seccionId)
                .order('apellidos');

            // 3. Load attendance
            const { data: attendanceData } = await supabase
                .from('control_asistencia')
                .select('*')
                .eq('seccion_id', seccionId)
                .eq('fecha', fecha)
                .eq('periodo', periodo);

            const attendanceMap: Record<string, LessonStatus[]> = {};
            if (attendanceData) {
                (attendanceData as any[]).forEach((r) => {
                    attendanceMap[r.estudiante_id] = mapStateToLessons(r.estado_id);
                });
            }

            if (studentsData) {
                const castedStudents = studentsData as Estudiante[];
                setEstudiantes(castedStudents);
                castedStudents.forEach(st => {
                    if (!attendanceMap[st.cedula]) {
                        attendanceMap[st.cedula] = ['P', 'P', 'P', 'P'];
                    }
                });
            }

            setAsistencias(attendanceMap);
        } catch (err) {
            console.error('Error loading data:', err);
            // No toast here as single() might fail if no config exists, which is normal
        } finally {
            setLoading(false);
        }
    }

    const handleLessonToggle = (cedula: string, lessonIdx: number) => {
        const statuses: LessonStatus[] = ['P', 'A', 'T', 'J'];
        setAsistencias(prev => {
            const current = [...prev[cedula]];
            const currentIndex = statuses.indexOf(current[lessonIdx]);
            current[lessonIdx] = statuses[(currentIndex + 1) % statuses.length];
            return { ...prev, [cedula]: current };
        });
    };

    const handleGeneralToggle = (cedula: string) => {
        setAsistencias(prev => {
            const isPresent = prev[cedula].every(l => l === 'P');
            return {
                ...prev,
                [cedula]: isPresent ? ['A', 'A', 'A', 'A'] : ['P', 'P', 'P', 'P']
            };
        });
    };

    async function handleSave() {
        setIsSaving(true);
        try {
            // 1. Save lesson configuration
            const { error: configError } = await (supabase as any)
                .from('configuracion_diaria')
                .upsert({
                    seccion_id: seccionId,
                    fecha: fecha,
                    periodo: periodo,
                    lecciones_totales: leccionesTotales,
                    observaciones: observaciones
                }, { onConflict: 'seccion_id, fecha, periodo' });

            if (configError) throw configError;

            // 2. Save attendance
            const upsertData = estudiantes.map(est => ({
                estudiante_id: est.cedula,
                seccion_id: seccionId,
                fecha: fecha,
                periodo: periodo,
                estado_id: mapLessonsToState(asistencias[est.cedula])
            }));

            const { error: attendanceError } = await supabase
                .from('control_asistencia')
                .upsert(upsertData as any, { onConflict: 'estudiante_id, fecha, periodo' });

            if (attendanceError) throw attendanceError;

            showToast('Asistencia y configuración guardadas', 'success');
            if (onSave) onSave();
        } catch (error: any) {
            console.error('Error saving:', error);
            showToast(`Error: ${error.message}`, 'error');
        } finally {
            setIsSaving(false);
        }
    }

    if (loading) return <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>Cargando lista...</div>;

    return (
        <div className="attendance-container">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <div className="glass-card" style={{ padding: '0.75rem 1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <label style={{ fontSize: '0.9rem', color: 'var(--text-muted)', fontWeight: 600 }}>Lecciones Impartidas hoy:</label>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        {[0, 1, 2, 3, 4].map(num => (
                            <button
                                key={num}
                                onClick={() => setLeccionesTotales(num)}
                                title={num === 0 ? "0 Lecciones / Día Libre" : `${num} lecciones`}
                                style={{
                                    width: '32px',
                                    height: '32px',
                                    borderRadius: '6px',
                                    border: 'none',
                                    background: leccionesTotales === num 
                                        ? (num === 0 ? 'var(--danger)' : 'var(--primary)') 
                                        : 'rgba(255,255,255,0.05)',
                                    color: 'white',
                                    cursor: 'pointer',
                                    fontWeight: 'bold',
                                    transition: 'all 0.2s',
                                    opacity: leccionesTotales === num ? 1 : 0.6
                                }}
                            >
                                {num === 0 ? 'Ø' : num}
                            </button>
                        ))}
                    </div>
                </div>
                <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="btn-primary"
                    style={{
                        padding: '0.75rem 2rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        opacity: isSaving ? 0.7 : 1
                    }}
                >
                    {isSaving ? '⌛ Guardando...' : '💾 Guardar Asistencia'}
                </button>
            </div>

            <div className="glass-card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', fontSize: '0.9rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '0.75rem' }}>
                    Observaciones del Grupo:
                </label>
                <textarea
                    value={observaciones}
                    onChange={(e) => setObservaciones(e.target.value)}
                    placeholder="Escriba aquí cualquier observación relevante sobre la sección o la lección de hoy..."
                    style={{
                        width: '100%',
                        minHeight: '80px',
                        background: 'rgba(255,255,255,0.03)',
                        border: '1px solid var(--glass-border)',
                        borderRadius: '8px',
                        padding: '0.75rem',
                        color: 'white',
                        fontSize: '0.9rem',
                        resize: 'vertical',
                        outline: 'none',
                        transition: 'border-color 0.2s'
                    }}
                    onFocus={(e) => e.target.style.borderColor = 'var(--primary)'}
                    onBlur={(e) => e.target.style.borderColor = 'var(--glass-border)'}
                />
            </div>

            <div className="glass-card" style={{ padding: '0', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--glass-border)' }}>
                            <th style={{ textAlign: 'left', padding: '1rem 1.5rem', fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Cédula</th>
                            <th style={{ textAlign: 'left', padding: '1rem', fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Nombre del Estudiante</th>
                            <th style={{ textAlign: 'center', padding: '1rem', fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Estado General</th>
                            {leccionesTotales >= 1 && <th style={{ textAlign: 'center', padding: '1rem', fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>L1</th>}
                            {leccionesTotales >= 2 && <th style={{ textAlign: 'center', padding: '1rem', fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>L2</th>}
                            {leccionesTotales >= 3 && <th style={{ textAlign: 'center', padding: '1rem', fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>L3</th>}
                            {leccionesTotales >= 4 && <th style={{ textAlign: 'center', padding: '1rem', fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>L4</th>}
                        </tr>
                    </thead>
                    <tbody>
                        {estudiantes.map((est) => {
                            const currentLessons = asistencias[est.cedula] || ['P', 'P', 'P', 'P'];
                            const isPresent = currentLessons.every(l => l === 'P');
                            const initials = `${est.nombre.charAt(0)}${est.apellidos.charAt(0)}`.toUpperCase();

                            return (
                                <tr key={est.cedula} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                    <td style={{ padding: '1rem 1.5rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>{est.cedula}</td>
                                    <td style={{ padding: '1rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                            <div style={{
                                                width: '32px',
                                                height: '32px',
                                                borderRadius: '50%',
                                                background: 'rgba(99, 102, 241, 0.1)',
                                                border: '1px solid rgba(99, 102, 241, 0.2)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                fontSize: '0.75rem',
                                                fontWeight: 600,
                                                color: 'var(--primary)'
                                            }}>{initials}</div>
                                            <div style={{ fontWeight: 500 }}>{est.nombre} {est.apellidos}</div>
                                        </div>
                                    </td>
                                    <td style={{ padding: '1rem', textAlign: 'center' }}>
                                        {leccionesTotales === 0 ? (
                                            <div style={{
                                                fontSize: '0.75rem',
                                                color: 'var(--text-muted)',
                                                fontStyle: 'italic',
                                                background: 'rgba(255,255,255,0.03)',
                                                padding: '0.3rem 0.6rem',
                                                borderRadius: '6px',
                                                display: 'inline-block'
                                            }}>
                                                Sin clases
                                            </div>
                                        ) : (
                                            <div
                                                onClick={() => handleGeneralToggle(est.cedula)}
                                                style={{
                                                    width: '60px',
                                                    height: '28px',
                                                    background: isPresent ? 'var(--primary)' : 'rgba(255,255,255,0.1)',
                                                    borderRadius: '14px',
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    padding: '0 4px',
                                                    cursor: 'pointer',
                                                    transition: 'all 0.3s ease',
                                                    position: 'relative'
                                                }}
                                            >
                                                <div style={{
                                                    width: '20px',
                                                    height: '20px',
                                                    background: 'white',
                                                    borderRadius: '50%',
                                                    transform: isPresent ? 'translateX(32px)' : 'translateX(0)',
                                                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                                    boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    fontSize: '10px'
                                                }}>{isPresent ? '✓' : ''}</div>
                                                <span style={{
                                                    position: 'absolute',
                                                    left: isPresent ? '8px' : '26px',
                                                    fontSize: '9px',
                                                    fontWeight: 700,
                                                    color: isPresent ? 'white' : 'var(--danger)',
                                                    pointerEvents: 'none'
                                                }}>
                                                    {isPresent ? 'PRES' : 'AUSEN'}
                                                </span>
                                            </div>
                                        )}
                                    </td>
                                    {[0, 1, 2, 3].slice(0, leccionesTotales).map(idx => (
                                        <td key={idx} style={{ padding: '1rem', textAlign: 'center' }}>
                                            <button
                                                onClick={() => handleLessonToggle(est.cedula, idx)}
                                                style={{
                                                    padding: '0.4rem 0.8rem',
                                                    borderRadius: '8px',
                                                    background: 'rgba(255,255,255,0.05)',
                                                    border: `1px solid ${lessonColors[currentLessons[idx]]}44`,
                                                    color: lessonColors[currentLessons[idx]],
                                                    fontSize: '0.85rem',
                                                    fontWeight: 700,
                                                    cursor: 'pointer',
                                                    minWidth: '40px',
                                                    transition: 'all 0.2s'
                                                }}
                                            >
                                                {currentLessons[idx]} ⌄
                                            </button>
                                        </td>
                                    ))}
                                </tr>
                            );
                        })}
                    </tbody>
                </table>

                <footer style={{ padding: '1.2rem 1.5rem', background: 'rgba(255,255,255,0.02)', borderTop: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                        Mostrando <strong>{estudiantes.length}</strong> estudiantes de la sección.
                    </div>
                    <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.75rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: lessonColors.P }}></div>
                            P = Presente
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: lessonColors.A }}></div>
                            A = Ausente
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: lessonColors.T }}></div>
                            T = Tardía
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: lessonColors.J }}></div>
                            J = Justificada
                        </div>
                    </div>
                </footer>
            </div>
        </div>
    );
}

