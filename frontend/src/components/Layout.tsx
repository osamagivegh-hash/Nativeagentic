import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  LayoutDashboard,
  MessageSquare,
  Lightbulb,
  Shield,
  Bot,
  Sparkles,
  Activity,
  Wallet
} from 'lucide-react';
import clsx from 'clsx';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'AI Chat', href: '/chat', icon: MessageSquare },
  { name: 'Transactions', href: '/transactions', icon: Wallet },
  { name: 'Insights', href: '/insights', icon: Lightbulb },
  { name: 'Agents', href: '/agents', icon: Bot },
  { name: 'Audit', href: '/audit', icon: Shield },
];

export function Layout() {
  const location = useLocation();

  return (
    <div className="min-h-screen bg-surface-primary bg-grid-pattern">
      {/* Background gradient */}
      <div className="fixed inset-0 bg-radial-gradient pointer-events-none" />

      {/* Sidebar */}
      <aside className="fixed left-0 top-0 h-screen w-64 bg-surface-secondary/50 backdrop-blur-xl border-r border-white/5 z-50">
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="p-6 border-b border-white/5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-nexus-500 to-accent-purple flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="font-display font-bold text-lg text-white">Nexus AI</h1>
                <p className="text-xs text-white/40">AI-Native Platform</p>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-1">
            {navigation.map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <NavLink
                  key={item.name}
                  to={item.href}
                  className={clsx(
                    'flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200',
                    isActive
                      ? 'bg-nexus-600/20 text-nexus-400 border border-nexus-500/30'
                      : 'text-white/60 hover:bg-surface-tertiary hover:text-white'
                  )}
                >
                  <item.icon className="w-5 h-5" />
                  <span className="font-medium">{item.name}</span>
                  {isActive && (
                    <motion.div
                      layoutId="nav-indicator"
                      className="ml-auto w-1.5 h-1.5 rounded-full bg-nexus-500"
                    />
                  )}
                </NavLink>
              );
            })}
          </nav>

          {/* Status */}
          <div className="p-4 border-t border-white/5">
            <div className="glass-card p-4">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Activity className="w-5 h-5 text-status-success" />
                  <div className="absolute -top-1 -right-1 w-2 h-2 bg-status-success rounded-full animate-pulse" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">System Active</p>
                  <p className="text-xs text-white/40">All services running</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="ml-64 min-h-screen">
        <div className="p-8">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <Outlet />
          </motion.div>
        </div>
      </main>
    </div>
  );
}






