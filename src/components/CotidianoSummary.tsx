
import React from 'react';

// Este componente ahora es "tonto". Solo recibe datos y los muestra.
interface CotidianoSummaryProps {
    periodo: number;
    onClose: () => void;
    estudiantes: any[];
    trabajos: any[];
    gradesMap: Record<string, Record<number, number>>;
    seccionNombre: string;
    seccionId: string;
    notasDirectas?: any[];
}

export const CotidianoSummary: React.FC<CotidianoSummaryProps> = ({ 
    seccionNombre,
    periodo,
    onClose,
    estudiantes,
    trabajos,
    gradesMap,
}) => {

    const handlePrint = () => {
        window.print();
    };

    // Un loader simple por si acaso, aunque el padre ya no debería mostrarlo si no hay datos.
    if (!estudiantes || !trabajos || !gradesMap) {
        return (
            <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                 <div className="glass-card" style={{ padding: '2rem', textAlign: 'center' }}>Preparando resumen...</div>
            </div>
        );
    }

    return (
        <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '2rem' }}>
            <div className="glass-card" style={{ width: '100%', maxWidth: '1200px', maxHeight: '90vh', overflow: 'auto', padding: '2rem', position: 'relative', background: '#1e1b4b' }}>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }} className="no-print">
                    <h2 style={{ margin: 0 }}>Resumen de Trabajo Cotidiano - {seccionNombre} - Sem {periodo}</h2>
                    <div style={{ display: 'flex', gap: '1rem' }}>
                        <button onClick={handlePrint} className="btn-primary" style={{ background: 'var(--primary)' }}>🖨️ Imprimir PDF</button>
                        <button onClick={onClose} className="btn-primary" style={{ background: 'rgba(255,255,255,0.1)' }}>Cerrar</button>
                    </div>
                </div>

                <div className="only-print" style={{ display: 'none', textAlign: 'center', marginBottom: '2rem' }}>
                    <h1 style={{ color: 'black' }}>Reporte de Trabajo Cotidiano - MEP 2026</h1>
                    <h2 style={{ color: 'black' }}>Sección: {seccionNombre} - Semestre: {periodo}</h2>
                </div>

                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                        <thead>
                            <tr style={{ borderBottom: '2px solid var(--glass-border)' }}>
                                <th style={{ textAlign: 'left', padding: '1rem' }}>Estudiante</th>
                                {trabajos.map((t, idx) => (
                                    <th key={t.id} style={{ textAlign: 'center', padding: '1rem' }}>
                                        TC{idx + 1}: {t.nombre}
                                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>(100%)</div>
                                    </th>
                                ))}
                                <th style={{ textAlign: 'center', padding: '1rem', color: 'var(--primary)' }}>PROMEDIO TC (35%)</th>
                            </tr>
                        </thead>
                        <tbody>
                            {estudiantes.map(est => {
                                const studentId = String(est.cedula).trim();
                                const studentGrades = gradesMap[studentId] || {};
                                let totalSum = 0;
                                trabajos.forEach(t => {
                                    totalSum += studentGrades[t.id] || 0;
                                });
                                const average = trabajos.length > 0 ? Math.round(totalSum / trabajos.length) : 0;
                                const finalContribution = ((average / 100) * 35).toFixed(2);

                                return (
                                    <tr key={est.cedula} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                        <td style={{ padding: '0.75rem 1rem' }}>{est.apellidos}, {est.nombre}</td>
                                        {trabajos.map(t => {
                                            const g = studentGrades[t.id] || 0;
                                            return (
                                                <td key={t.id} style={{ textAlign: 'center', padding: '0.75rem', color: g < 70 ? 'var(--danger)' : 'white', fontWeight: 600 }}>
                                                    {g}%
                                                </td>
                                            );
                                        })}
                                        <td style={{ textAlign: 'center', padding: '0.75rem', fontWeight: 800, color: 'var(--primary)', fontSize: '1rem' }}>
                                            {finalContribution}%
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                <style>{`
                    @media print {
                        /* Estilos de impresión idénticos a TareaSummary */
                    }
                `}</style>
            </div>
        </div>
    );
};
