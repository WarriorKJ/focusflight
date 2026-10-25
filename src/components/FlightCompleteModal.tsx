import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { Award, CheckCircle2, MapPin, Compass, Clock, ArrowRight } from 'lucide-react';
import { FlightBooking } from '../types/flight';
import { playTouchdownFanfare } from '../services/soundEffects';

interface FlightCompleteModalProps {
  booking: FlightBooking;
  onBookNext: () => void;
}

export const FlightCompleteModal: React.FC<FlightCompleteModalProps> = ({
  booking,
  onBookNext,
}) => {
  useEffect(() => {
    playTouchdownFanfare();
    try {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#0ea5e9', '#38bdf8', '#f59e0b', '#10b981', '#ffffff'],
      });
    } catch {
      // ignore
    }
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
      <div className="max-w-lg w-full bg-slate-900 border border-sky-500/40 rounded-3xl p-6 sm:p-8 shadow-2xl text-center relative overflow-hidden ring-1 ring-sky-500/30">
        
        {/* Glow ambient background */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-sky-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-amber-500/20 rounded-full blur-3xl pointer-events-none" />

        {/* Badge */}
        <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-500 to-sky-500 flex items-center justify-center text-white shadow-lg shadow-sky-500/20 mb-4 animate-bounce">
          <Award className="w-8 h-8" />
        </div>

        <span className="text-xs font-bold uppercase tracking-widest text-emerald-400 font-mono">
          Flight Completed • Touchdown
        </span>

        <h2 className="text-2xl sm:text-3xl font-black text-white mt-1">
          Welcome to {booking.destination.city}!
        </h2>

        <p className="text-slate-300 text-sm mt-2">
          You have completed your {booking.durationMinutes}-minute focus flight aboard {booking.airline.name}.
        </p>

        {/* Flight Summary Stats */}
        <div className="my-6 p-5 rounded-2xl bg-slate-950/80 border border-slate-800 text-left space-y-3">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div>
              <span className="text-[10px] uppercase font-mono text-slate-400 block">Flight</span>
              <span className="text-base font-black font-mono text-white">{booking.flightNumber}</span>
            </div>
            <div className="text-right">
              <span className="text-[10px] uppercase font-mono text-slate-400 block">Route</span>
              <span className="text-sm font-bold font-mono text-sky-400">
                {booking.departure.iata} → {booking.destination.iata}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 pt-1 text-center font-mono">
            <div className="bg-slate-900/60 p-2.5 rounded-xl border border-slate-800">
              <span className="text-[10px] text-slate-400 uppercase block">Distance</span>
              <span className="font-bold text-white text-xs">{booking.distanceKm.toLocaleString()} km</span>
            </div>
            <div className="bg-slate-900/60 p-2.5 rounded-xl border border-slate-800">
              <span className="text-[10px] text-slate-400 uppercase block">Duration</span>
              <span className="font-bold text-white text-xs">{booking.durationMinutes} min</span>
            </div>
            <div className="bg-slate-900/60 p-2.5 rounded-xl border border-slate-800">
              <span className="text-[10px] text-slate-400 uppercase block">Seat</span>
              <span className="font-bold text-emerald-400 text-xs">{booking.seat}</span>
            </div>
          </div>

          {booking.taskTitle && (
            <div className="text-xs text-slate-300 pt-2 border-t border-slate-800/80">
              <span className="text-slate-400 font-mono text-[10px] uppercase block">Focus Objective</span>
              <span className="font-semibold text-white">"{booking.taskTitle}"</span>
            </div>
          )}
        </div>

        {/* Action Button */}
        <div>
          <button
            type="button"
            onClick={onBookNext}
            className="w-full py-3.5 px-5 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white font-bold text-sm transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer active:scale-98"
          >
            <span>Book Next Flight</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
