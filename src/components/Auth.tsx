import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useToast } from './Toast';

export const Auth: React.FC = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [view, setView] = useState<'login' | 'register' | 'forgot_password'>('login');
    const { showToast } = useToast();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });
        
        if (error) {
            showToast(`Error de ingreso: ${error.message}`, 'error');
        } else {
            showToast('Ingreso exitoso', 'success');
        }
        setLoading(false);
    };

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        const { error, data } = await supabase.auth.signUp({
            email,
            password,
        });

        if (error) {
            showToast(`Error al crear usuario: ${error.message}`, 'error');
        } else if (data.user && data.session === null) {
            showToast('Revisa tu correo para verificar la cuenta.', 'success');
            setView('login');
        } else {
            showToast('Usuario creado y validado correctamente', 'success');
        }
        setLoading(false);
    };

    const handlePasswordReset = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        const { error } = await supabase.auth.resetPasswordForEmail(email);
        if (error) {
            showToast(`Error: ${error.message}`, 'error');
        } else {
            showToast('Enlace de recuperación enviado a tu correo.', 'success');
            setView('login');
        }
        setLoading(false);
    };

    return (
        <div style={{ 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center', 
            minHeight: '100vh', 
            padding: '2rem' 
        }}>
            <div className="glass-card" style={{ 
                width: '100%', 
                maxWidth: '400px', 
                padding: '2.5rem', 
                textAlign: 'center' 
            }}>
                <div style={{ marginBottom: '2rem' }}>
                    <div style={{ 
                        width: '60px', 
                        height: '60px', 
                        background: 'linear-gradient(135deg, var(--primary), #818cf8)', 
                        borderRadius: '16px', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        fontSize: '2rem',
                        margin: '0 auto 1.5rem',
                        boxShadow: '0 8px 32px rgba(99, 102, 241, 0.3)'
                    }}>
                        🔐
                    </div>
                    <h1 style={{ fontSize: '1.8rem', fontWeight: 800, marginBottom: '0.5rem' }}>
                        {view === 'login' ? 'Bienvenido' : view === 'register' ? 'Nuevo Usuario' : 'Recuperar Cuenta'}
                    </h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                        {view === 'login' ? 'Ingresa tus credenciales para continuar' : 
                         view === 'register' ? 'Crea la cuenta de docente administrador' : 
                         'Te enviaremos un enlace para restaurar tu clave'}
                    </p>
                </div>

                <form onSubmit={view === 'login' ? handleLogin : view === 'register' ? handleRegister : handlePasswordReset} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
                    
                    <div style={{ textAlign: 'left' }}>
                        <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Correo Electrónico</label>
                        <input
                            type="email"
                            placeholder="docente@ejemplo.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            className="glass-card"
                            style={{ 
                                width: '100%', 
                                padding: '1rem', 
                                background: 'rgba(255,255,255,0.03)', 
                                border: '1px solid rgba(255,255,255,0.1)', 
                                color: 'white', 
                                outline: 'none',
                                transition: 'border 0.3s ease'
                            }}
                            onFocus={(e) => e.target.style.border = '1px solid var(--primary)'}
                            onBlur={(e) => e.target.style.border = '1px solid rgba(255,255,255,0.1)'}
                        />
                    </div>

                    {view !== 'forgot_password' && (
                        <div style={{ textAlign: 'left' }}>
                            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Contraseña</label>
                            <input
                                type="password"
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                className="glass-card"
                                style={{ 
                                    width: '100%', 
                                    padding: '1rem', 
                                    background: 'rgba(255,255,255,0.03)', 
                                    border: '1px solid rgba(255,255,255,0.1)', 
                                    color: 'white', 
                                    outline: 'none',
                                    transition: 'border 0.3s ease'
                                }}
                                onFocus={(e) => e.target.style.border = '1px solid var(--primary)'}
                                onBlur={(e) => e.target.style.border = '1px solid rgba(255,255,255,0.1)'}
                            />
                        </div>
                    )}

                    <button 
                        type="submit" 
                        disabled={loading}
                        className="btn-primary" 
                        style={{ 
                            padding: '1rem', 
                            fontSize: '1rem', 
                            fontWeight: 700,
                            marginTop: '0.5rem',
                            opacity: loading ? 0.7 : 1
                        }}
                    >
                        {loading ? 'Procesando...' : 
                         view === 'login' ? 'Ingresar' : 
                         view === 'register' ? 'Crear Usuario' : 
                         'Enviar Código'}
                    </button>
                </form>

                <div style={{ marginTop: '2rem', display: 'flex', flexDirection: 'column', gap: '0.8rem', fontSize: '0.85rem' }}>
                    {view === 'login' ? (
                        <>
                            <button onClick={() => setView('forgot_password')} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', textDecoration: 'underline' }}>¿Olvidaste tu contraseña?</button>
                            <button onClick={() => setView('register')} style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontWeight: 600 }}>Crea tu cuenta de docente aquí</button>
                        </>
                    ) : (
                        <button onClick={() => setView('login')} style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontWeight: 600 }}>Volver al ingreso seguro</button>
                    )}
                </div>
            </div>
        </div>
    );
};
