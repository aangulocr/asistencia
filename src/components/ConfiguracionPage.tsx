import React, { useState, useEffect } from 'react';
import {
    EvaluationWeights,
    DEFAULT_EVALUATION_WEIGHTS,
    getEvaluationWeights,
    saveEvaluationWeights,
} from '../lib/evalConfig';
import { useToast } from './Toast';

export const ConfiguracionPage: React.FC = () => {
    const [weights, setWeights] = useState<EvaluationWeights>(() => getEvaluationWeights());
    const { showToast } = useToast();

    useEffect(() => {
        setWeights(getEvaluationWeights());
    }, []);

    const total = Number(
        (weights.asistencia + weights.cotidiano + weights.tareas + weights.examenes).toFixed(2)
    );
    const isValidTotal = Math.abs(total - 100) < 0.01;

    const handleChange = (field: keyof EvaluationWeights, raw: string) => {
        if (raw === '') {
            setWeights(prev => ({ ...prev, [field]: 0 }));
            return;
        }
        let val = parseFloat(raw);
        if (isNaN(val)) return;
        if (val < 0) val = 0;
        if (val > 100) val = 100;
        setWeights(prev => ({ ...prev, [field]: val }));
    };

    const handleSave = () => {
        if (!isValidTotal) {
            showToast(
                `La suma de los porcentajes debe ser exactamente 100% (actualmente: ${total}%).`,
                'error'
            );
            return;
        }
        saveEvaluationWeights(weights);
        showToast('Configuración de porcentajes guardada correctamente', 'success');
    };

    const handleRestoreDefaults = () => {
        setWeights({ ...DEFAULT_EVALUATION_WEIGHTS });
        saveEvaluationWeights({ ...DEFAULT_EVALUATION_WEIGHTS });
        showToast('Valores predeterminados MEP restaurados (5% / 35% / 10% / 50%)', 'success');
    };

    const componentsList: {
        key: keyof EvaluationWeights;
        icon: string;
        label: string;
        description: string;
        defaultVal: number;
    }[] = [
        {
            key: 'asistencia',
            icon: '📅',
            label: 'Asistencia',
            description: 'Valor porcentual aplicado al control de ausentismo según la escala semestral.',
            defaultVal: DEFAULT_EVALUATION_WEIGHTS.asistencia,
        },
        {
            key: 'cotidiano',
            icon: '📝',
            label: 'Trabajo Cotidiano',
            description: 'Calculado mediante el promedio de las notas de cada trabajo cotidiano por este porcentaje.',
            defaultVal: DEFAULT_EVALUATION_WEIGHTS.cotidiano,
        },
        {
            key: 'tareas',
            icon: '📚',
            label: 'Tareas',
            description: 'Calculado mediante el promedio de las tareas evaluadas por este porcentaje.',
            defaultVal: DEFAULT_EVALUATION_WEIGHTS.tareas,
        },
        {
            key: 'examenes',
            icon: '✍️',
            label: 'Exámenes',
            description: 'Tope porcentual máximo que podrán sumar las pruebas creadas en cada semestre.',
            defaultVal: DEFAULT_EVALUATION_WEIGHTS.examenes,
        },
    ];

    return (
        <div className="config-page">
            <header style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                    <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>Configuración de Evaluación</h1>
                    <p style={{ color: 'var(--text-muted)' }}>
                        Define los valores porcentuales de cada componente para el cálculo de las notas por semestre.
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                    <button
                        onClick={handleRestoreDefaults}
                        className="btn-primary"
                        style={{
                            background: 'rgba(255,255,255,0.08)',
                            border: '1px solid var(--glass-border)',
                            minHeight: '44px'
                        }}
                    >
                        ↺ Restaurar Valores MEP
                    </button>
                    <button
                        onClick={handleSave}
                        className="btn-primary"
                        style={{
                            background: isValidTotal ? 'var(--primary)' : 'rgba(239, 68, 68, 0.3)',
                            border: isValidTotal ? 'none' : '1px solid var(--danger)',
                            minHeight: '44px'
                        }}
                    >
                        💾 Guardar Configuración
                    </button>
                </div>
            </header>

            {/* Resumen del Total */}
            <div
                className="glass-card"
                style={{
                    padding: '1.25rem 1.5rem',
                    marginBottom: '1.5rem',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '1rem',
                    borderColor: isValidTotal ? 'rgba(34, 197, 94, 0.35)' : 'rgba(239, 68, 68, 0.5)'
                }}
            >
                <div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Suma Total de Componentes
                    </div>
                    <div style={{ fontSize: '0.9rem', color: isValidTotal ? 'var(--success)' : 'var(--danger)', marginTop: '0.25rem', fontWeight: 500 }}>
                        {isValidTotal
                            ? '✓ Distribución válida (100% completo). Lista para aplicar a los cálculos.'
                            : `⚠️ La suma debe ser exactamente 100%. ${total < 100 ? `Falta ${Number((100 - total).toFixed(2))}%` : `Excede por ${Number((total - 100).toFixed(2))}%`}.`}
                    </div>
                </div>
                <div
                    style={{
                        fontSize: '2rem',
                        fontWeight: 800,
                        color: isValidTotal ? 'var(--success)' : 'var(--danger)'
                    }}
                >
                    {total}%
                </div>
            </div>

            {/* Tarjetas de Componentes */}
            <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
                {componentsList.map(comp => (
                    <div key={comp.key} className="glass-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '1rem' }}>
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                    <span style={{ fontSize: '1.5rem' }}>{comp.icon}</span>
                                    <h2 style={{ fontSize: '1.15rem', margin: 0 }}>{comp.label}</h2>
                                </div>
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                    MEP: {comp.defaultVal}%
                                </span>
                            </div>
                            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                                {comp.description}
                            </p>
                        </div>

                        <div>
                            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                                Porcentaje asignado (%)
                            </label>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <input
                                    type="number"
                                    min={0}
                                    max={100}
                                    step={0.5}
                                    value={weights[comp.key]}
                                    onChange={e => handleChange(comp.key, e.target.value)}
                                    className="glass-card"
                                    style={{
                                        width: '100%',
                                        minHeight: '44px',
                                        padding: '0.65rem 1rem',
                                        background: 'rgba(255,255,255,0.05)',
                                        color: 'white',
                                        fontSize: '1.25rem',
                                        fontWeight: 700,
                                        textAlign: 'center',
                                        border: '1px solid var(--glass-border)',
                                        outline: 'none'
                                    }}
                                />
                                <span style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--primary)' }}>%</span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
