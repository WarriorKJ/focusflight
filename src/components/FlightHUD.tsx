import React, { useState } from 'react';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Bell,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
} from 'lucide-react';
import { FlightBooking, FlightStatus } from '../types/flight';

interface FlightHUDProps {
  booking: FlightBooking;
  flightStatus: FlightStatus;
  progress: number; // 0 to 1
  secondsRemaining: number;
  isPaused: boolean;
  onTogglePause: () => void;
  isCabinNoisePlaying: boolean;
  onToggleCabinNoise: () => void;
  cameraMode: 'globe' | 'follow' | 'cockpit';
  onChangeCameraMode: (mode: 'globe' | 'follow' | 'cockpit') => void;
  unreadNotificationsCount: number;
  onToggleNotifications: () => void;
  onEmergencyLanding: () => void;
}

export const FlightHUD: React.FC<FlightHUDProps> = ({
  booking,
  flightStatus,
  progress,
  secondsRemaining,
  isPaused,
  onTogglePause,
  isCabinNoisePlaying,
  onToggleCabinNoise,
  cameraMode,
  onChangeCameraMode,
  unreadNotificationsCount,
  onToggleNotifications,
  onEmergencyLanding,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Format countdown
  const hours = Math.floor(secondsRemaining / 3600);
  const minutes = Math.floor((secondsRemaining % 3600) / 60);
  const seconds = secondsRemaining % 60;

  const timeFormatted =
    hours > 0
      ? `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
      : `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

  const distanceTraveled = Math.round(booking.distanceKm * progress);
  const distanceRemaining = Math.max(0, booking.distanceKm - distanceTraveled);

  const currentAltitudeFt = Math.round(Math.sin(progress * Math.PI) * 38000);
  const groundSpeedKts = isPaused ? 0 : 495 + Math.round(Math.sin(progress * Math.PI * 2) * 25);

  const getStatusLabel = () => {
    if (isPaused) return 'HOLDING PATTERN';
    if (progress < 0.08) return 'TAXI & TAKEOFF';
    if (progress < 0.22) return 'CLIMBING (TO FL380)';
    if (progress < 0.8) return 'CRUISING (FL380)';
    if (progress < 0.95) return 'DESCENT PHASE';
    return 'FINAL APPROACH';
  };

  return (
    <>
      {/* TOP STATUS BAR (Minimal, Zero Center Occlusion) */}
      <div className="absolute top-4 left-4 right-4 pointer-events-none flex items-center justify-between z-30">
        {/* Left: Flight Number & Route */}
        <div className="pointer-events-auto flex items-center gap-2.5 bg-slate-900/90 border border-slate-800/80 px-3.5 py-2 rounded-xl backdrop-blur-md shadow-lg">
          <div
            className="w-2.5 h-2.5 rounded-full"
            style={{ backgroundColor: booking.airline.primaryColor }}
          />
          <div className="text-left">
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold text-xs text-white">
                {booking.flightNumber}
              </span>
              <span className="text-[11px] text-slate-400 font-mono">
                {booking.departure.iata} → {booking.destination.iata}
              </span>
            </div>
            {booking.taskTitle && (
              <div className="text-[10px] text-sky-400 font-medium truncate max-w-[160px] sm:max-w-xs">
                {booking.taskTitle}
              </div>
            )}
          </div>
        </div>

        {/* Center: Flight Status Tag */}
        <div className="hidden sm:flex pointer-events-auto items-center gap-2 bg-slate-900/90 border border-slate-800/80 px-3.5 py-1.5 rounded-full backdrop-blur-md shadow-lg text-xs font-mono font-bold">
          <span
            className={`w-2 h-2 rounded-full ${
              isPaused ? 'bg-amber-400' : 'bg-emerald-400'
            }`}
          />
          <span className={isPaused ? 'text-amber-300' : 'text-emerald-300'}>
            {getStatusLabel()}
          </span>
        </div>

        {/* Right: Notification Alerts & Divert */}
        <div className="pointer-events-auto flex items-center gap-2">
          <button
            type="button"
            onClick={onToggleNotifications}
            className="relative bg-slate-900/90 hover:bg-slate-800 border border-slate-800 px-3 py-2 rounded-xl backdrop-blur-md shadow-lg text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Bell className="w-4 h-4 text-sky-400" />
            <span className="hidden sm:inline">Alerts</span>
            {unreadNotificationsCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-red-500 text-white font-mono text-[10px] font-bold">
                {unreadNotificationsCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={onEmergencyLanding}
            title="Divert Flight"
            className="bg-slate-900/90 hover:bg-red-500/20 hover:border-red-500/50 border border-slate-800 p-2 rounded-xl backdrop-blur-md shadow-lg text-slate-400 hover:text-red-400 transition-all cursor-pointer"
          >
            <AlertTriangle className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* FLOATING TIME TO ARRIVAL (Automatically shown above the globe when controls are hidden) */}
      {isCollapsed && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-30 pointer-events-auto animate-in fade-in slide-in-from-top-3 duration-300">
          <div className="bg-slate-900/95 border border-sky-500/50 px-5 py-3 rounded-2xl backdrop-blur-md shadow-2xl flex items-center gap-4 ring-1 ring-sky-500/30">
            <div className="text-left">
              <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-sky-400 block">
                TIME TO ARRIVAL
              </span>
              <span className="text-3xl font-black font-mono tracking-tight text-white block">
                {timeFormatted}
              </span>
            </div>

            <div className="h-8 w-px bg-slate-800" />

            <div className="text-right">
              <div className="flex items-center gap-2 justify-end">
                <span
                  className={`w-2 h-2 rounded-full ${
                    isPaused ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'
                  }`}
                />
                <span className="text-[11px] font-mono font-bold text-sky-300 uppercase">
                  {isPaused ? 'HOLDING' : `${(progress * 100).toFixed(1)}% Completed`}
                </span>
              </div>
              <span className="text-xs font-mono font-semibold text-slate-300 block mt-0.5">
                {distanceRemaining.toLocaleString()} km to {booking.destination.iata}
              </span>
            </div>

            <div className="h-8 w-px bg-slate-800" />

            <button
              type="button"
              onClick={onTogglePause}
              title={isPaused ? "Resume flight" : "Pause flight"}
              className={`p-2 rounded-xl transition-all cursor-pointer ${
                isPaused
                  ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 ring-2 ring-amber-400/50'
                  : 'bg-slate-800 hover:bg-slate-700 text-white'
              }`}
            >
              {isPaused ? <Play className="w-4 h-4 fill-current" /> : <Pause className="w-4 h-4 fill-current" />}
            </button>
          </div>
        </div>
      )}

      {/* COLLAPSED BUTTON: Positioned right at the very bottom edge of the screen */}
      {isCollapsed && (
        <div className="fixed bottom-0 left-1/2 -translate-x-1/2 z-40">
          <button
            type="button"
            onClick={() => setIsCollapsed(false)}
            className="px-5 py-2 rounded-t-xl bg-slate-900/95 border border-b-0 border-slate-700 text-slate-200 hover:text-white text-xs font-mono font-bold flex items-center gap-1.5 backdrop-blur-md shadow-2xl transition-all hover:bg-slate-800 cursor-pointer"
          >
            <ChevronUp className="w-4 h-4 text-sky-400" />
            <span>Show Flight Deck HUD</span>
          </button>
        </div>
      )}

      {/* EXPANDED BOTTOM DOCK: Pinned to Bottom-Center */}
      {!isCollapsed && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-full max-w-4xl px-4 z-30 pointer-events-none">
          <div className="pointer-events-auto flex flex-col items-center">
            
            {/* Collapse Tab */}
            <button
              type="button"
              onClick={() => setIsCollapsed(true)}
              className="mb-1 px-4 py-1 rounded-t-lg bg-slate-900/90 border border-b-0 border-slate-800 text-slate-400 hover:text-white text-xs font-mono flex items-center gap-1.5 backdrop-blur-md shadow-md transition-all cursor-pointer"
            >
              <ChevronDown className="w-3.5 h-3.5 text-sky-400" />
              <span>Hide Controls</span>
            </button>

            {/* Dock Card */}
            <div className="w-full bg-slate-900/95 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-2xl backdrop-blur-md">
              
              {/* Top row: Timer Countdown & Primary Flight Controls */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pb-3 border-b border-slate-800">
                
                {/* Countdown */}
                <div className="flex items-baseline gap-3">
                  <span className="text-4xl sm:text-5xl font-black font-mono tracking-tight text-white">
                    {timeFormatted}
                  </span>
                  <div className="text-left">
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                      Time to Arrival
                    </span>
                    <span className="text-xs font-mono font-semibold text-sky-400">
                      {(progress * 100).toFixed(1)}% Completed
                    </span>
                  </div>
                </div>

                {/* Controls (Play/Pause, Sound, Camera) */}
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={onTogglePause}
                    className={`px-4 py-2 rounded-xl text-xs font-bold font-mono flex items-center gap-2 transition-all shadow-md cursor-pointer ${
                      isPaused
                        ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 ring-2 ring-amber-400/50'
                        : 'bg-slate-800 hover:bg-slate-700 text-white'
                    }`}
                  >
                    {isPaused ? (
                      <>
                        <Play className="w-4 h-4 fill-current" />
                        <span>Resume Flight</span>
                      </>
                    ) : (
                      <>
                        <Pause className="w-4 h-4 fill-current" />
                        <span>Holding Pattern (Pause)</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={onToggleCabinNoise}
                    title="Toggle Cabin Engine White Noise for focus"
                    className={`px-3 py-2 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-all border cursor-pointer ${
                      isCabinNoisePlaying
                        ? 'bg-sky-500/20 border-sky-500/60 text-sky-300 shadow-sm'
                        : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:text-white'
                    }`}
                  >
                    {isCabinNoisePlaying ? (
                      <>
                        <Volume2 className="w-4 h-4 text-sky-400" />
                        <span>Cabin Hum: ON</span>
                      </>
                    ) : (
                      <>
                        <VolumeX className="w-4 h-4" />
                        <span>Cabin Hum: OFF</span>
                      </>
                    )}
                  </button>

                  {/* Camera View Selector */}
                  <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800">
                    <button
                      type="button"
                      onClick={() => onChangeCameraMode('globe')}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all cursor-pointer ${
                        cameraMode === 'globe'
                          ? 'bg-sky-500 text-white font-bold'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Globe
                    </button>
                    <button
                      type="button"
                      onClick={() => onChangeCameraMode('follow')}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all cursor-pointer ${
                        cameraMode === 'follow'
                          ? 'bg-sky-500 text-white font-bold'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Follow Plane
                    </button>
                    <button
                      type="button"
                      onClick={() => onChangeCameraMode('cockpit')}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all cursor-pointer ${
                        cameraMode === 'cockpit'
                          ? 'bg-sky-500 text-white font-bold'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Cockpit
                    </button>
                  </div>
                </div>
              </div>

              {/* Progress Track Bar */}
              <div className="pt-3 pb-2">
                <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-emerald-400">{booking.departure.iata}</span>
                    <span>({booking.departure.city})</span>
                  </div>
                  <div className="text-slate-300 font-bold">
                    {distanceTraveled.toLocaleString()} / {booking.distanceKm.toLocaleString()} km
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span>({booking.destination.city})</span>
                    <span className="font-bold text-amber-400">{booking.destination.iata}</span>
                  </div>
                </div>

                <div className="w-full h-2.5 bg-slate-950 rounded-full overflow-hidden p-0.5 border border-slate-800 relative">
                  <div
                    className="h-full rounded-full transition-all duration-300 ease-linear"
                    style={{
                      width: `${Math.max(2, Math.min(100, progress * 100))}%`,
                      backgroundColor: booking.airline.primaryColor || '#0ea5e9',
                    }}
                  />
                </div>
              </div>

              {/* Telemetry Gauges */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 text-xs font-mono">
                <div className="bg-slate-950/70 p-2 rounded-xl border border-slate-800/80 text-left">
                  <span className="text-[10px] text-slate-500 uppercase block">Ground Speed</span>
                  <span className="text-slate-200 font-bold">{groundSpeedKts} kts</span>
                  <span className="text-[10px] text-slate-500 block">
                    ~{Math.round(groundSpeedKts * 1.852)} km/h
                  </span>
                </div>

                <div className="bg-slate-950/70 p-2 rounded-xl border border-slate-800/80 text-left">
                  <span className="text-[10px] text-slate-500 uppercase block">Altitude</span>
                  <span className="text-slate-200 font-bold">
                    {currentAltitudeFt.toLocaleString()} ft
                  </span>
                  <span className="text-[10px] text-slate-500 block">
                    {currentAltitudeFt > 30000 ? 'Cruising FL380' : 'Climb/Descent'}
                  </span>
                </div>

                <div className="bg-slate-950/70 p-2 rounded-xl border border-slate-800/80 text-left">
                  <span className="text-[10px] text-slate-500 uppercase block">Outside Temp</span>
                  <span className="text-slate-200 font-bold">
                    {progress > 0.2 && progress < 0.8 ? '-54°C (-65°F)' : '-22°C (-8°F)'}
                  </span>
                  <span className="text-[10px] text-slate-500 block">Stratosphere</span>
                </div>

                <div className="bg-slate-950/70 p-2 rounded-xl border border-slate-800/80 text-left">
                  <span className="text-[10px] text-slate-500 uppercase block">Distance Remaining</span>
                  <span className="text-sky-300 font-bold">
                    {distanceRemaining.toLocaleString()} km
                  </span>
                  <span className="text-[10px] text-slate-500 block">
                    {Math.round(distanceRemaining * 0.54).toLocaleString()} NM
                  </span>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}
    </>
  );
};
