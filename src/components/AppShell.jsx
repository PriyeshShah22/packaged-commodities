import React from 'react';
import { BarChart3, FileText, LogOut, Menu, PackageSearch, PlusCircle, ShieldCheck, X } from 'lucide-react';
import { NavLink, useNavigate } from 'react-router-dom';
import PackMetrixLogo from './brand/PackMetrixLogo';
import { useAuth } from '../context/auth-context';

export default function AppShell({ children, title, eyebrow, actions }) {
  const { user, logout, hasRole } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = React.useState(false);
  const items = [
    { to: '/dashboard', label: 'Dashboard', icon: BarChart3, show: true },
    { to: '/inspections/new', label: 'New inspection', icon: PlusCircle, show: hasRole('inspector', 'admin') },
    { to: '/reports', label: 'View reports', icon: FileText, show: true },
    { to: '/products', label: 'Product register', icon: PackageSearch, show: true },
  ];
  const signOut = () => { logout(); navigate('/login'); };
  return <div className="min-h-screen bg-[#F7F8FA] text-slate-900 lg:flex">
    {open && <button className="fixed inset-0 bg-slate-950/40 z-30 lg:hidden" onClick={() => setOpen(false)} aria-label="Close navigation overlay" />}
    <aside className={`fixed lg:sticky top-0 left-0 z-40 h-screen w-72 bg-slate-950 text-white flex flex-col transition-transform ${open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
      <div className="h-20 px-6 border-b border-white/10 flex items-center justify-between"><PackMetrixLogo size="sm" variant="dark" onClick={() => navigate('/dashboard')} /><button onClick={() => setOpen(false)} className="lg:hidden"><X /></button></div>
      <div className="p-4"><p className="px-3 py-2 text-[10px] font-bold tracking-[.18em] text-slate-500">INSPECTION OFFICE</p><nav className="space-y-1">{items.filter((item) => item.show).map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} onClick={() => setOpen(false)} className={({ isActive }) => `flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-semibold ${isActive ? 'bg-sky-600 text-white' : 'text-slate-300 hover:bg-white/8 hover:text-white'}`}><Icon className="w-4.5 h-4.5" />{label}</NavLink>)}</nav></div>
      <div className="mt-auto p-4 border-t border-white/10"><div className="px-3 mb-3"><p className="text-sm font-bold truncate">{user?.name}</p><p className="text-xs text-slate-400 truncate">{user?.roles?.join(' · ')}</p></div><button onClick={signOut} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-slate-300 hover:bg-white/8"><LogOut className="w-4 h-4" />Sign out</button></div>
    </aside>
    <div className="flex-1 min-w-0"><header className="h-20 bg-white border-b border-slate-200 sticky top-0 z-20 px-5 sm:px-8 flex items-center gap-4"><button onClick={() => setOpen(true)} className="lg:hidden p-2 border border-slate-200 rounded-lg"><Menu className="w-5 h-5" /></button><div className="min-w-0"><p className="text-[10px] font-bold tracking-[.17em] text-sky-700 flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5" />{eyebrow || 'PACKMETRIX'}</p><h1 className="font-extrabold truncate">{title}</h1></div><div className="ml-auto flex items-center gap-3">{actions}</div></header><main className="p-5 sm:p-8 max-w-[1500px] mx-auto">{children}</main></div>
  </div>;
}
