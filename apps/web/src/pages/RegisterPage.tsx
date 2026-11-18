import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ShieldCheck, ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext.js';
import { useToast } from '../context/ToastContext.js';

export const RegisterPage: React.FC = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [workspaceName, setWorkspaceName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { register } = useAuth();
  const { error } = useToast();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await register({
        name,
        email,
        password,
        workspaceName: workspaceName || undefined,
      });
      navigate('/');
    } catch (err: any) {
      error(
        'Registration Failed',
        err.response?.data?.error?.message || 'Could not create account'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-canvas p-4">
      <div className="w-full max-w-md bg-surface border border-boundary rounded-2xl shadow-xl p-8 animate-fade-in">
        <div className="flex flex-col items-center text-center">
          <div className="w-12 h-12 rounded-xl bg-brand-700 flex items-center justify-center text-white shadow-md mb-3">
            <ShieldCheck className="w-7 h-7" />
          </div>
          <h1 className="text-xl font-bold text-ink-primary">Create your Account</h1>
          <p className="text-xs text-ink-secondary mt-1">
            Start monitoring your HTTP APIs in minutes
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-3.5">
          <div>
            <label className="block text-xs font-semibold text-ink-primary mb-1">Full Name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Alice Johnson"
              className="w-full px-3.5 py-2 text-sm bg-white border border-boundary rounded-lg text-ink-primary placeholder:text-ink-muted focus:ring-2 focus:ring-brand-400 focus:outline-hidden"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-ink-primary mb-1">
              Work Email Address
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="alice@company.com"
              className="w-full px-3.5 py-2 text-sm bg-white border border-boundary rounded-lg text-ink-primary placeholder:text-ink-muted focus:ring-2 focus:ring-brand-400 focus:outline-hidden"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-ink-primary mb-1">Password</label>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              className="w-full px-3.5 py-2 text-sm bg-white border border-boundary rounded-lg text-ink-primary placeholder:text-ink-muted focus:ring-2 focus:ring-brand-400 focus:outline-hidden"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-ink-primary mb-1">
              Workspace Name <span className="text-ink-muted font-normal">(Optional)</span>
            </label>
            <input
              type="text"
              value={workspaceName}
              onChange={(e) => setWorkspaceName(e.target.value)}
              placeholder="e.g. Acme Backend Services"
              className="w-full px-3.5 py-2 text-sm bg-white border border-boundary rounded-lg text-ink-primary placeholder:text-ink-muted focus:ring-2 focus:ring-brand-400 focus:outline-hidden"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full mt-3 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-brand-700 hover:bg-brand-800 disabled:opacity-60 rounded-lg shadow-xs transition-colors focus:ring-2 focus:ring-brand-400 focus:outline-hidden"
          >
            {submitting ? 'Creating account...' : 'Create Account'}
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <div className="mt-6 text-center text-xs text-ink-secondary">
          Already registered?{' '}
          <Link to="/login" className="font-semibold text-brand-700 hover:text-brand-800">
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
};
