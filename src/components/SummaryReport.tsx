import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

interface Props {
    seccionId: string;
    periodo: number;
    onClose: () => void;
}

interface StudentReport {
    cedula: string;
    nombreCompleto: string;
    fechasAusencias: string[];
    totalAusencias: number;
    porcentaje: number;
    nota: string;
}

export function SummaryReport({ seccionId, periodo, onClose }: Props) {
    const [reports, setReports] = useState<StudentReport[]>([]);
    const [loading, setLoading] = useState(true);
    const [lessonDates, setLessonDates] = useState<{fecha: string, lecciones: number}[]>([]);

    useEffect(() => {
        generateReport();
    }, [seccionId, periodo]);

    const getNotaAsignada = (porcentaje: number): string => {
        if (porcentaje < 10) return "5%";
        if (porcentaje < 20) return "4%";
        if (porcentaje < 30) return "3%";
        if (porcentaje < 40) return "2%";
        if (porcentaje < 50) return "1%";
        return "0%";
    };

    async function generateReport() {
        setLoading(true);
        try {
            // 1. Students
            const { data: studentsData } = await supabase
                .from('estudiantes')
                .select('*')
                .eq('seccion_id', seccionId);
            const students = studentsData as any[] || [];

            // 2. Attendance
            const { data: attendanceData } = await supabase
                .from('control_asistencia')
                .select('estudiante_id, fecha, estado_id, estados_asistencia(nombre, peso_ausencia)')
                .eq('seccion_id', seccionId)
                .eq('periodo', periodo);
            const attendance = attendanceData as any[] || [];

            // 3. Lesson Config
            const { data: configData } = await supabase
                .from('configuracion_diaria')
                .select('fecha, lecciones_totales')
                .eq('seccion_id', seccionId)
                .eq('periodo', periodo);
            const config = configData as any[] || [];

            const configMap: Record<string, number> = {};
            config.forEach(c => configMap[c.fecha] = c.lecciones_totales);

            // Calculate "Global Programmed Lessons" for the section period
            const uniqueDates = Array.from(new Set(attendance.map(a => a.fecha))) as string[];
            uniqueDates.sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
            
            const taughtDates = uniqueDates.map(date => ({
                fecha: date,
                lecciones: configMap[date] ?? 4
            }));
            setLessonDates(taughtDates);

            let globalLeccionesProgramadas = 0;
            uniqueDates.forEach(date => {
                globalLeccionesProgramadas += configMap[date] ?? 4;
            });

            // 4. Calculate stats per student
            const studentReports: StudentReport[] = students.map(student => {
                const studentAttendance = attendance.filter(a => a.estudiante_id === student.cedula);

                let studentAbsenceWeight = 0;
                const datesWithAbsence: string[] = [];

                studentAttendance.forEach((record: any) => {
                    const lessonsToday = configMap[record.fecha] ?? 4;
                    let peso = record.estados_asistencia?.peso_ausencia || 0;
                    if (peso > 0) {
                        // Proportional weight based on lessons today
                        peso = (peso / 4) * lessonsToday;
                        studentAbsenceWeight += peso;
                        datesWithAbsence.push(`${record.fecha} (${record.estados_asistencia.nombre})`);
                    }
                });

                // User requested to floor the total absences (e.g. 1.5 -> 1)
                const finalAbsenceWeight = Math.floor(studentAbsenceWeight);
                const porcentaje = globalLeccionesProgramadas > 0 ? (finalAbsenceWeight / globalLeccionesProgramadas) * 100 : 0;

                return {
                    cedula: student.cedula,
                    nombreCompleto: `${student.nombre} ${student.apellidos}`,
                    fechasAusencias: datesWithAbsence,
                    totalAusencias: finalAbsenceWeight,
                    porcentaje: parseFloat(porcentaje.toFixed(2)),
                    nota: getNotaAsignada(porcentaje)
                };
            });

            setReports(studentReports);
        } catch (error) {
            console.error('Error generating report:', error);
        } finally {
            setLoading(false);
        }
    }

    if (loading) return null;

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            background: 'rgba(0,0,0,0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            backdropFilter: 'blur(8px)',
            padding: '2rem'
        }}>
            <div className="glass-card" style={{
                padding: '2rem',
                maxWidth: '1200px',
                width: '100%',
                maxHeight: '90vh',
                overflowY: 'auto',
                position: 'relative',
                animation: 'scaleIn 0.3s ease-out'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--glass-border)', paddingBottom: '1rem' }}>
                    <h3 style={{ margin: 0 }}>Resumen de Asistencia y Calificación - Semestre {periodo}</h3>
                    <button
                        onClick={onClose}

                        id="close-report-btn"
                        className="btn-primary"
                        style={{ padding: '0.5rem 1rem', background: 'var(--danger)' }}
                    >
                        Cerrar Resumen
                    </button>
                </div>

                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid var(--glass-border)', color: 'var(--text-muted)' }}>
                                <th style={{ textAlign: 'left', padding: '1rem' }}>Estudiante</th>
                                <th style={{ textAlign: 'left', padding: '1rem' }}>Fechas con Ausencia/Tardía</th>
                                <th style={{ textAlign: 'center', padding: '1rem' }}>Total Ausencias</th>
                                <th style={{ textAlign: 'center', padding: '1rem' }}>% Ausentismo</th>
                                <th style={{ textAlign: 'center', padding: '1rem', background: 'rgba(129, 140, 248, 0.1)' }}>Nota Sugerida</th>
                            </tr>
                        </thead>
                        <tbody>
                            {reports.map(report => (
                                <tr key={report.cedula} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                    <td style={{ padding: '1rem', fontWeight: 500 }}>{report.nombreCompleto}</td>
                                    <td style={{ padding: '1rem', fontSize: '0.8rem', maxWidth: '300px' }}>
                                        {report.fechasAusencias.length > 0 ? (
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                                                {report.fechasAusencias.map((f, i) => (
                                                    <span key={i} style={{ background: 'rgba(255,255,255,0.05)', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>
                                                        {f}
                                                    </span>
                                                ))}
                                            </div>
                                        ) : (
                                            <span style={{ color: 'var(--success)', opacity: 0.7 }}>Sin ausencias</span>
                                        )}
                                    </td>
                                    <td style={{ padding: '1rem', textAlign: 'center', color: report.totalAusencias > 0 ? 'var(--danger)' : 'inherit' }}>
                                        {report.totalAusencias}
                                    </td>
                                    <td style={{ padding: '1rem', textAlign: 'center' }}>
                                        {report.porcentaje}%
                                    </td>
                                    <td style={{ padding: '1rem', textAlign: 'center', fontWeight: 700, color: 'var(--primary)' }}>
                                        {report.nota}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {lessonDates.length > 0 && (
                    <div style={{ 
                        marginTop: '2rem', 
                        padding: '1rem', 
                        background: 'rgba(255,255,255,0.02)', 
                        border: '1px solid var(--glass-border)', 
                        borderRadius: '8px',
                        fontSize: '0.8rem',
                        color: 'var(--text-muted)'
                    }}>
                        <h4 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-secondary)' }}>Lecciones impartidas por fecha</h4>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                            {lessonDates.map((item, idx) => (
                                <div key={idx} style={{ 
                                    background: 'rgba(0,0,0,0.2)', 
                                    padding: '0.3rem 0.6rem', 
                                    borderRadius: '4px',
                                    border: '1px solid rgba(255,255,255,0.05)'
                                }}>
                                    <span style={{ fontWeight: 600 }}>{item.fecha}</span>: {item.lecciones} lec.
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
