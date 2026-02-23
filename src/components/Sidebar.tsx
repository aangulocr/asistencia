import React from 'react';

interface SidebarProps {
    className?: string;
    currentView: 'attendance' | 'students' | 'cotidiano' | 'tareas' | 'examenes' | 'asistencia_nota' | 'reports';
    onViewChange: (view: 'attendance' | 'students' | 'cotidiano' | 'tareas' | 'examenes' | 'asistencia_nota' | 'reports') => void;
    periodo: number;
    onPeriodoChange: (periodo: number) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ className, currentView, onViewChange, periodo, onPeriodoChange }) => {
    const evaluationItems = [
        { id: 'attendance', icon: '📅', label: 'Asistencia' },
        { id: 'cotidiano', icon: '📝', label: 'Trabajo Cotidiano' },
        { id: 'tareas', icon: '📚', label: 'Tareas' },
        { id: 'examenes', icon: '✍️', label: 'Exámenes' },
    ];

    const managementItems = [
        { id: 'reports', icon: '📊', label: 'Reportes' },
        { id: 'students', icon: '👤', label: 'Estudiantes' },
    ];

    const enabledViews = ['attendance', 'asistencia_nota', 'cotidiano', 'tareas', 'examenes', 'reports', 'students'];

    const renderNavItem = (item: any) => {
        const isEnabled = enabledViews.includes(item.id);
        return (
            <button
                key={item.id}
                onClick={() => isEnabled && onViewChange(item.id as any)}
                className={`nav-item ${currentView === item.id ? 'active' : ''}`}
                style={{
                    background: 'none',
                    border: 'none',
                    width: '100%',
                    textAlign: 'left',
                    cursor: isEnabled ? 'pointer' : 'not-allowed',
                    opacity: isEnabled ? 1 : 0.5,
                    fontFamily: 'inherit',
                    fontSize: 'inherit',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    padding: '0.85rem 1rem',
                    borderRadius: '12px',
                    color: currentView === item.id ? 'var(--primary)' : 'white',
                    transition: 'all 0.3s ease'
                }}
            >
                <span className="nav-icon" style={{ fontSize: '1.2rem' }}>{item.icon}</span>
                <span className="nav-label" style={{ fontWeight: 500 }}>{item.label}</span>
            </button>
        );
    };

    return (
        <aside className={`sidebar glass-card ${className || ''}`} style={{ display: 'flex', flexDirection: 'column' }}>
            <div className="sidebar-header" style={{ padding: '1.5rem 1rem' }}>
                <div className="logo">
                    <span className="logo-icon" style={{ fontSize: '1.8rem' }}>🏫</span>
                    <span className="logo-text" style={{ fontSize: '1.2rem', fontWeight: 800, background: 'linear-gradient(135deg, #fff 0%, #a5b4fc 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>MEP 2026</span>
                </div>
            </div>

            <div className="semester-selector" style={{ padding: '0 1rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase', paddingLeft: '1rem' }}>
                    Periodo Académico
                </div>
                <div style={{ display: 'flex', background: 'rgba(255,255,255,0.05)', padding: '0.25rem', borderRadius: '10px', gap: '0.25rem' }}>
                    {[1, 2].map(p => (
                        <button
                            key={p}
                            onClick={() => onPeriodoChange(p)}
                            style={{
                                flex: 1,
                                padding: '0.5rem',
                                borderRadius: '8px',
                                background: periodo === p ? 'var(--primary)' : 'transparent',
                                border: 'none',
                                color: 'white',
                                fontSize: '0.8rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                                transition: 'all 0.2s ease'
                            }}
                        >
                            Semestre {p}
                        </button>
                    ))}
                </div>
            </div>

            <nav className="sidebar-nav" style={{ flex: 1, padding: '0 0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div className="nav-section-label" style={{ padding: '1.5rem 1rem 0.5rem', fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                    Docencia y Evaluación
                </div>
                {evaluationItems.map(renderNavItem)}

                <div style={{ margin: '1rem 0.75rem', height: '1px', background: 'linear-gradient(to right, transparent, var(--glass-border), transparent)', opacity: 0.5 }} />

                <div className="nav-section-label" style={{ padding: '0.5rem 1rem 0.5rem', fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                    Administración
                </div>
                {managementItems.map(renderNavItem)}
            </nav>


            <div className="sidebar-footer">
                <div className="user-profile">
                    <div className="user-avatar">👤</div>
                    <div className="user-info">
                        <span className="user-name">Profesor</span>
                        <span className="user-role">Administrador</span>
                    </div>
                </div>
            </div>
        </aside>
    );
};
