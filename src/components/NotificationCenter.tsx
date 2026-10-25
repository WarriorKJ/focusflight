import React, { useState } from 'react';
import {
  Bell,
  X,
  CloudSun,
  Radio,
  CheckCircle2,
  Volume2,
  Shield,
  Plane,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import { FlightNotification } from '../types/flight';
import { requestNotificationPermission } from '../services/notificationService';

interface NotificationCenterProps {
  notifications: FlightNotification[];
  isOpen: boolean;
  onClose: () => void;
  activeToast: FlightNotification | null;
  onDismissToast: () => void;
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({
  notifications,
  isOpen,
  onClose,
  activeToast,
  onDismissToast,
}) => {
  const [filter, setFilter] = useState<'all' | 'boarding' | 'weather'>('all');
  const [hasWebNotification, setHasWebNotification] = useState<boolean>(() => {
    return typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted';
  });

  const handleEnableSystemNotifications = async () => {
    const granted = await requestNotificationPermission();
    setHasWebNotification(granted);
  };

  const filtered = notifications.filter((n) => {
    if (filter === 'boarding') return n.type === 'boarding' || n.type === 'atc' || n.type === 'milestone';
    if (filter === 'weather') return n.type === 'weather';
    return true;
  });

  const getIcon = (type: FlightNotification['type']) => {
    switch (type) {
      case 'weather':
        return <CloudSun className="w-4 h-4 text-amber-400" />;
      case 'boarding':
        return <Plane className="w-4 h-4 text-sky-400" />;
      case 'atc':
        return <Radio className="w-4 h-4 text-emerald-400" />;
      default:
        return <CheckCircle2 className="w-4 h-4 text-sky-400" />;
    }
  };

  return (
    <>
      {/* FLOATING ACTIVE NOTIFICATION TOAST (Top-Right Alert Banner) */}
      {activeToast && (
        <div className="fixed top-20 right-4 z-50 max-w-sm w-full animate-in slide-in-from-top-4 duration-300 pointer-events-auto">
          <div className="bg-slate-900/95 border border-sky-500/50 rounded-2xl p-4 shadow-2xl backdrop-blur-md text-white flex items-start gap-3 ring-1 ring-sky-500/20">
            <div className="p-2 rounded-xl bg-sky-500/10 border border-sky-500/20 shrink-0 mt-0.5">
              {getIcon(activeToast.type)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-sky-400">
                  {activeToast.type === 'weather' ? 'Weather Update' : 'Flight Deck Alert'}
                </span>
                <span className="text-[10px] text-slate-400 font-mono">Just now</span>
              </div>
              <h4 className="text-sm font-bold text-white mt-0.5 truncate">{activeToast.title}</h4>
              <p className="text-xs text-slate-300 mt-1 leading-relaxed">{activeToast.message}</p>
            </div>
            <button
              type="button"
              onClick={onDismissToast}
              className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* NOTIFICATION DRAWER / MODAL */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs transition-opacity">
          <div className="w-full max-w-md h-full bg-slate-900 border-l border-slate-800 shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
            {/* Header */}
            <div className="p-5 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-sky-500/10 text-sky-400">
                  <Bell className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">In-Flight Communications</h3>
                  <p className="text-xs text-slate-400">Boarding announcements &amp; weather reports</p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* System Push Notification Permission Promo */}
            {!hasWebNotification && (
              <div className="m-4 p-3.5 rounded-xl bg-gradient-to-r from-sky-950/60 to-slate-900 border border-sky-500/30 flex items-center justify-between gap-3">
                <div className="text-left">
                  <div className="text-xs font-bold text-sky-300">Enable Desktop Notifications</div>
                  <div className="text-[11px] text-slate-400">
                    Get boarding alerts &amp; weather while working in other tabs
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleEnableSystemNotifications}
                  className="px-3 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-bold shrink-0 transition-colors cursor-pointer"
                >
                  Enable
                </button>
              </div>
            )}

            {/* Filter Tabs */}
            <div className="px-5 pt-3 pb-2 flex gap-2 border-b border-slate-800/80">
              <button
                type="button"
                onClick={() => setFilter('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  filter === 'all'
                    ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                All ({notifications.length})
              </button>
              <button
                type="button"
                onClick={() => setFilter('boarding')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  filter === 'boarding'
                    ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Boarding &amp; ATC
              </button>
              <button
                type="button"
                onClick={() => setFilter('weather')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  filter === 'weather'
                    ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Weather Reports
              </button>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              {filtered.length === 0 ? (
                <div className="text-center py-12 text-slate-500 text-xs">
                  No notifications recorded yet. Alerts will appear as your flight progresses.
                </div>
              ) : (
                filtered.map((item) => (
                  <div
                    key={item.id}
                    className={`p-3.5 rounded-xl border text-left transition-all ${
                      item.important
                        ? 'bg-sky-950/40 border-sky-500/40 ring-1 ring-sky-500/20'
                        : 'bg-slate-950/60 border-slate-800/80'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        {getIcon(item.type)}
                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 font-mono">
                          {item.type}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-500 font-mono">
                        {item.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div className="text-sm font-bold text-white mb-1">{item.title}</div>
                    <div className="text-xs text-slate-300 leading-relaxed">{item.message}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
