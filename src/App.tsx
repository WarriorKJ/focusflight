import React, { useState, useEffect, useRef } from 'react';
import { Plane, Volume2 } from 'lucide-react';
import {
  FlightBooking,
  FlightNotification,
  FlightStatus,
} from './types/flight';
import { BookingForm } from './components/BookingForm';
import { BoardingPass } from './components/BoardingPass';
import { FlightGlobe3D } from './components/FlightGlobe3D';
import { FlightHUD } from './components/FlightHUD';
import { NotificationCenter } from './components/NotificationCenter';
import { FlightCompleteModal } from './components/FlightCompleteModal';
import {
  generateDepartureWeatherAlert,
  generateArrivalWeatherAlert,
  generateEnRouteWeatherUpdate,
  generateMilestoneAlert,
} from './services/notificationService';
import { cabinNoise, playCabinChime } from './services/soundEffects';

type AppScreen = 'BOOKING' | 'CHECK_IN' | 'IN_FLIGHT' | 'COMPLETED';

export default function App() {
  const [screen, setScreen] = useState<AppScreen>('BOOKING');
  const [currentBooking, setCurrentBooking] = useState<FlightBooking | null>(null);

  // Flight Timer States
  const [totalSeconds, setTotalSeconds] = useState(25 * 60);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [continuousProgress, setContinuousProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [cameraMode, setCameraMode] = useState<'globe' | 'follow' | 'cockpit'>('globe');
  const [isCabinNoisePlaying, setIsCabinNoisePlaying] = useState(false);

  // Notifications
  const [notifications, setNotifications] = useState<FlightNotification[]>([]);
  const [activeToast, setActiveToast] = useState<FlightNotification | null>(null);
  const [isNotificationDrawerOpen, setIsNotificationDrawerOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // Milestone triggers tracking
  const triggeredMilestones = useRef<Set<string>>(new Set());

  // Dispatch notification
  const pushNotification = (notif: FlightNotification) => {
    setNotifications((prev) => [notif, ...prev]);
    setActiveToast(notif);
    setUnreadCount((prev) => prev + 1);

    setTimeout(() => {
      setActiveToast((current) => (current?.id === notif.id ? null : current));
    }, 6000);
  };

  // 1. Booking confirmed -> Proceed to Check-In & Boarding Pass
  const handleBookingConfirmed = (booking: FlightBooking) => {
    setCurrentBooking(booking);
    setTotalSeconds(booking.durationMinutes * 60);
    setElapsedSeconds(0);
    setContinuousProgress(0);
    setIsPaused(false);
    triggeredMilestones.current.clear();
    setScreen('CHECK_IN');
  };

  // 2. Boarding Pass stub torn -> Proceed to In-Flight Globe
  const handleStubTorn = () => {
    if (!currentBooking) return;
    setScreen('IN_FLIGHT');

    // Initial Takeoff & Departure Weather Announcements
    const depWeather = generateDepartureWeatherAlert(currentBooking);
    const takeoffAlert = generateMilestoneAlert('takeoff', currentBooking);

    setNotifications([takeoffAlert, depWeather]);
    setActiveToast(takeoffAlert);
    setUnreadCount(2);

    cabinNoise.start(0.18);
    setIsCabinNoisePlaying(true);
  };

  // 3. Flight Timer Tick Loop (1 second resolution for digital clock HUD)
  useEffect(() => {
    if (screen !== 'IN_FLIGHT' || isPaused || !currentBooking) return;

    const interval = setInterval(() => {
      setElapsedSeconds((prev) => {
        const next = prev + 1;
        const currentProgressFrac = next / totalSeconds;

        // Check milestones
        if (currentProgressFrac >= 0.15 && !triggeredMilestones.current.has('cruise')) {
          triggeredMilestones.current.add('cruise');
          pushNotification(generateMilestoneAlert('cruise', currentBooking));
        }

        if (currentProgressFrac >= 0.35 && !triggeredMilestones.current.has('weather-mid1')) {
          triggeredMilestones.current.add('weather-mid1');
          pushNotification(generateEnRouteWeatherUpdate(35));
        }

        if (currentProgressFrac >= 0.5 && !triggeredMilestones.current.has('halfway')) {
          triggeredMilestones.current.add('halfway');
          pushNotification(generateMilestoneAlert('halfway', currentBooking));
        }

        if (currentProgressFrac >= 0.7 && !triggeredMilestones.current.has('weather-mid2')) {
          triggeredMilestones.current.add('weather-mid2');
          pushNotification(generateEnRouteWeatherUpdate(70));
        }

        if (currentProgressFrac >= 0.85 && !triggeredMilestones.current.has('descent')) {
          triggeredMilestones.current.add('descent');
          pushNotification(generateMilestoneAlert('descent', currentBooking));
        }

        if (currentProgressFrac >= 0.94 && !triggeredMilestones.current.has('approach')) {
          triggeredMilestones.current.add('approach');
          pushNotification(generateMilestoneAlert('approach', currentBooking));
          setTimeout(() => {
            pushNotification(generateArrivalWeatherAlert(currentBooking));
          }, 1500);
        }

        // Landing Check
        if (next >= totalSeconds) {
          clearInterval(interval);
          handleFlightCompletion();
          return totalSeconds;
        }

        return next;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [screen, isPaused, totalSeconds, currentBooking]);

  // Handle Flight Completion
  const handleFlightCompletion = () => {
    if (!currentBooking) return;

    cabinNoise.stop();
    setIsCabinNoisePlaying(false);

    const touchdownAlert = generateMilestoneAlert('touchdown', currentBooking);
    pushNotification(touchdownAlert);

    setScreen('COMPLETED');
  };

  // Pause / Resume (Holding pattern)
  const handleTogglePause = () => {
    setIsPaused((prev) => {
      const next = !prev;
      playCabinChime('single');
      if (next) {
        pushNotification({
          id: 'hold-' + Date.now(),
          timestamp: new Date(),
          type: 'atc',
          title: 'Air Traffic Control: Holding Pattern',
          message: 'Aircraft entered holding pattern. Flight timer paused.',
        });
      } else {
        pushNotification({
          id: 'resume-' + Date.now(),
          timestamp: new Date(),
          type: 'atc',
          title: 'Air Traffic Control: Cleared on Course',
          message: 'Holding pattern terminated. Flight course resumed.',
        });
      }
      return next;
    });
  };

  // Toggle Cabin Engine Hum (White noise)
  const handleToggleCabinNoise = () => {
    if (isCabinNoisePlaying) {
      cabinNoise.stop();
      setIsCabinNoisePlaying(false);
    } else {
      cabinNoise.start(0.2);
      setIsCabinNoisePlaying(true);
    }
  };

  // Abort / Emergency landing
  const handleEmergencyLanding = () => {
    if (confirm('Divert flight and return to booking?')) {
      cabinNoise.stop();
      setIsCabinNoisePlaying(false);
      setScreen('BOOKING');
    }
  };

  const secondsRemaining = Math.max(0, totalSeconds - elapsedSeconds);
  const displayProgress = Math.max(continuousProgress, totalSeconds > 0 ? elapsedSeconds / totalSeconds : 0);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans select-none relative overflow-x-hidden">
      
      {/* GLOBAL TOP NAVIGATION HEADER */}
      <header className="border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md sticky top-0 z-40 px-4 sm:px-6 py-3 flex items-center justify-between">
        <div
          onClick={() => {
            if (screen === 'IN_FLIGHT') {
              if (confirm('Leave flight deck and return to booking? Flight progress will be reset.')) {
                cabinNoise.stop();
                setIsCabinNoisePlaying(false);
                setScreen('BOOKING');
              }
            } else {
              setScreen('BOOKING');
            }
          }}
          className="flex items-center gap-2.5 cursor-pointer group"
        >
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-sky-500 to-blue-600 flex items-center justify-center text-white shadow-md shadow-sky-500/20 group-hover:scale-105 transition-transform">
            <Plane className="w-4 h-4 transform -rotate-45" />
          </div>
          <div>
            <span className="font-black text-lg text-white tracking-tight flex items-center gap-1.5">
              FocusFlight
            </span>
          </div>
        </div>

        {/* Header Right Actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          {screen === 'IN_FLIGHT' && (
            <button
              type="button"
              onClick={handleToggleCabinNoise}
              title="Cabin engine hum focus noise"
              className={`p-2 sm:px-3 sm:py-2 rounded-xl border text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
                isCabinNoisePlaying
                  ? 'bg-sky-500/20 border-sky-500/60 text-sky-300'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              <Volume2 className="w-4 h-4" />
              <span className="hidden sm:inline">Engine Hum</span>
            </button>
          )}
        </div>
      </header>

      {/* MAIN VIEW CONTENT CONTAINER */}
      <main className="flex-1 flex flex-col relative overflow-hidden">
        
        {/* 1. FLIGHT BOOKING FORM */}
        {screen === 'BOOKING' && (
          <BookingForm
            onBookingConfirmed={handleBookingConfirmed}
          />
        )}

        {/* 2. BOARDING PASS & INTERACTIVE STUB TEAR */}
        {screen === 'CHECK_IN' && currentBooking && (
          <BoardingPass
            booking={currentBooking}
            onTearComplete={handleStubTorn}
          />
        )}

        {/* 3. IN-FLIGHT 3D GLOBE & TELEMETRY HUD */}
        {screen === 'IN_FLIGHT' && currentBooking && (
          <div className="relative w-full h-[calc(100vh-57px)]">
            {/* 3D Earth Globe with Country Borders & Continuous Flight Arc */}
            <FlightGlobe3D
              departure={currentBooking.departure}
              destination={currentBooking.destination}
              totalDurationSeconds={totalSeconds}
              isPaused={isPaused}
              cameraMode={cameraMode}
              airlineColor={currentBooking.airline.primaryColor}
              onContinuousProgressUpdate={setContinuousProgress}
            />

            {/* Flight Deck HUD with Collapsible Bottom Dock */}
            <FlightHUD
              booking={currentBooking}
              flightStatus={isPaused ? 'HOLDING' : 'CRUISING'}
              progress={displayProgress}
              secondsRemaining={secondsRemaining}
              isPaused={isPaused}
              onTogglePause={handleTogglePause}
              isCabinNoisePlaying={isCabinNoisePlaying}
              onToggleCabinNoise={handleToggleCabinNoise}
              cameraMode={cameraMode}
              onChangeCameraMode={setCameraMode}
              unreadNotificationsCount={unreadCount}
              onToggleNotifications={() => {
                setIsNotificationDrawerOpen(true);
                setUnreadCount(0);
              }}
              onEmergencyLanding={handleEmergencyLanding}
            />
          </div>
        )}

        {/* 4. FLIGHT COMPLETION MODAL */}
        {screen === 'COMPLETED' && currentBooking && (
          <FlightCompleteModal
            booking={currentBooking}
            onBookNext={() => {
              setScreen('BOOKING');
              setCurrentBooking(null);
            }}
          />
        )}

        {/* IN-FLIGHT NOTIFICATION CENTER */}
        <NotificationCenter
          notifications={notifications}
          isOpen={isNotificationDrawerOpen}
          onClose={() => setIsNotificationDrawerOpen(false)}
          activeToast={activeToast}
          onDismissToast={() => setActiveToast(null)}
        />
      </main>
    </div>
  );
}
