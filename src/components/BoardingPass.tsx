import React, { useState, useRef } from 'react';
import { Plane } from 'lucide-react';
import { FlightBooking } from '../types/flight';
import { playCabinChime, playPaperTearSound } from '../services/soundEffects';

interface BoardingPassProps {
  booking: FlightBooking;
  onTearComplete: () => void;
}

export const BoardingPass: React.FC<BoardingPassProps> = ({ booking, onTearComplete }) => {
  const [isTorn, setIsTorn] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragDistance, setDragDistance] = useState(0);
  const dragStartX = useRef(0);
  const dragStartY = useRef(0);

  const handleTear = () => {
    if (isTorn) return;
    setIsTorn(true);
    playPaperTearSound();
    setTimeout(() => {
      playCabinChime('dingdong');
    }, 450);
    setTimeout(() => {
      onTearComplete();
    }, 1100);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (isTorn) return;
    setIsDragging(true);
    dragStartX.current = e.clientX;
    dragStartY.current = e.clientY;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || isTorn) return;
    const dx = e.clientX - dragStartX.current;
    const dy = e.clientY - dragStartY.current;
    const dist = Math.sqrt(dx * dx + dy * dy);
    setDragDistance(dist);

    if (dist >= 55) {
      setIsDragging(false);
      handleTear();
    }
  };

  const handleMouseUp = () => {
    if (!isTorn) {
      setIsDragging(false);
      setDragDistance(0);
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (isTorn) return;
    setIsDragging(true);
    dragStartX.current = e.touches[0].clientX;
    dragStartY.current = e.touches[0].clientY;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || isTorn) return;
    const dx = e.touches[0].clientX - dragStartX.current;
    const dy = e.touches[0].clientY - dragStartY.current;
    const dist = Math.sqrt(dx * dx + dy * dy);
    setDragDistance(dist);

    if (dist >= 50) {
      setIsDragging(false);
      handleTear();
    }
  };

  const handleTouchEnd = () => {
    if (!isTorn) {
      setIsDragging(false);
      setDragDistance(0);
    }
  };

  const departureDate = booking.scheduledDepartureTime
    .toLocaleDateString('en-US', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
    .toUpperCase();

  const classLetter =
    booking.cabinClass === 'First Class'
      ? 'F'
      : booking.cabinClass === 'Business'
      ? 'J'
      : booking.cabinClass === 'Premium Economy'
      ? 'W'
      : 'Y';

  // Rotation angles at half the angle as requested:
  // Left part: -2.5° about bottom right corner
  // Right stub: +4.5° about bottom left corner
  const leftRotation = isTorn ? -2.5 : isDragging ? Math.min(2.5, dragDistance * 0.05) * -1 : 0;
  const rightRotation = isTorn ? 4.5 : isDragging ? Math.min(4.5, dragDistance * 0.08) : 0;
  const rightTranslateX = isTorn ? 18 : isDragging ? Math.min(18, dragDistance * 0.3) : 0;
  const rightTranslateY = isTorn ? 10 : isDragging ? Math.min(10, dragDistance * 0.18) : 0;

  return (
    <div
      className="flex flex-col items-center justify-center min-h-[calc(100vh-6rem)] p-4 sm:p-6"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Boarding Pass with standard 2.36:1 aspect ratio (between 2.27:1 and 2.46:1) */}
      <div
        className="relative w-full max-w-4xl select-none filter drop-shadow-2xl"
        style={{
          aspectRatio: '2.36 / 1',
          minHeight: '280px',
        }}
      >
        <div className="w-full h-full flex flex-row items-stretch">
          
          {/* LEFT MAIN PART OF FLIGHT TICKET (72% width) */}
          <div
            className="w-[72%] h-full bg-white text-slate-900 rounded-l-2xl border border-r-0 border-slate-300 shadow-xl overflow-hidden flex flex-col justify-between transition-all duration-700 ease-out z-10"
            style={{
              transformOrigin: 'bottom right',
              transform: `rotate(${leftRotation}deg)`,
            }}
          >
            {/* Header Bar */}
            <div
              className="px-5 py-2.5 sm:py-3 flex items-center justify-between text-white shrink-0"
              style={{ backgroundColor: booking.airline.primaryColor }}
            >
              <div className="flex items-center gap-2.5">
                <span className="text-base sm:text-lg font-black tracking-wider uppercase">
                  {booking.airline.name}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[10px] sm:text-xs font-mono font-bold tracking-widest uppercase opacity-90">
                  BOARDING PASS
                </span>
                <span className="text-[10px] sm:text-xs font-mono font-bold px-2 py-0.5 rounded bg-white/20">
                  CLASS {classLetter}
                </span>
              </div>
            </div>

            {/* Middle Content */}
            <div className="px-5 py-3 sm:py-4 flex-1 flex flex-col justify-between">
              
              {/* Row 1: Passenger, Flight, Date, Class */}
              <div className="grid grid-cols-4 gap-2 pb-2.5 border-b border-slate-200">
                <div>
                  <span className="text-[9px] sm:text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 block">
                    PASSENGER NAME
                  </span>
                  <span className="text-xs sm:text-sm font-black font-mono text-slate-900 uppercase block truncate">
                    {booking.passengerName}
                  </span>
                </div>

                <div>
                  <span className="text-[9px] sm:text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 block">
                    FLIGHT
                  </span>
                  <span className="text-xs sm:text-sm font-black font-mono text-slate-900 uppercase block">
                    {booking.flightNumber}
                  </span>
                </div>

                <div>
                  <span className="text-[9px] sm:text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 block">
                    DATE
                  </span>
                  <span className="text-xs sm:text-sm font-black font-mono text-slate-900 uppercase block">
                    {departureDate}
                  </span>
                </div>

                <div>
                  <span className="text-[9px] sm:text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 block">
                    CABIN
                  </span>
                  <span className="text-xs sm:text-sm font-black font-mono text-slate-900 uppercase block truncate">
                    {booking.cabinClass.toUpperCase()}
                  </span>
                </div>
              </div>

              {/* Row 2: Origin ✈ Destination */}
              <div className="grid grid-cols-11 gap-1 items-center py-1 sm:py-2">
                <div className="col-span-5 text-left">
                  <span className="text-[8px] sm:text-[9px] font-mono font-bold uppercase tracking-wider text-slate-400 block">
                    FROM
                  </span>
                  <span className="text-2xl sm:text-4xl font-black font-mono text-slate-900 block leading-tight">
                    {booking.departure.iata}
                  </span>
                  <span className="text-xs sm:text-sm font-bold text-slate-800 uppercase block truncate">
                    {booking.departure.city}
                  </span>
                </div>

                <div className="col-span-1 flex justify-center">
                  <Plane className="w-4 h-4 text-slate-400 transform rotate-90" />
                </div>

                <div className="col-span-5 text-right">
                  <span className="text-[8px] sm:text-[9px] font-mono font-bold uppercase tracking-wider text-slate-400 block">
                    TO
                  </span>
                  <span className="text-2xl sm:text-4xl font-black font-mono text-slate-900 block leading-tight">
                    {booking.destination.iata}
                  </span>
                  <span className="text-xs sm:text-sm font-bold text-slate-800 uppercase block truncate">
                    {booking.destination.city}
                  </span>
                </div>
              </div>

              {/* Row 3: Gate, Boarding Time, Seat, Group */}
              <div className="grid grid-cols-4 gap-2 pt-2 border-t border-slate-200 bg-slate-50/90 px-3 py-2 rounded-xl">
                <div>
                  <span className="text-[8px] sm:text-[9px] font-mono font-bold uppercase tracking-wider text-slate-400 block">
                    GATE
                  </span>
                  <span className="text-sm sm:text-lg font-black font-mono text-slate-900 block">
                    {booking.gate}
                  </span>
                </div>

                <div>
                  <span className="text-[8px] sm:text-[9px] font-mono font-bold uppercase tracking-wider text-slate-400 block">
                    BOARDING
                  </span>
                  <span className="text-sm sm:text-lg font-black font-mono text-slate-900 block">
                    {booking.scheduledDepartureTime.toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                      hour12: false,
                    })}
                  </span>
                </div>

                <div>
                  <span className="text-[8px] sm:text-[9px] font-mono font-bold uppercase tracking-wider text-slate-400 block">
                    SEAT
                  </span>
                  <span className="text-base sm:text-xl font-black font-mono text-sky-600 block">
                    {booking.seat}
                  </span>
                </div>

                <div>
                  <span className="text-[8px] sm:text-[9px] font-mono font-bold uppercase tracking-wider text-slate-400 block">
                    GROUP
                  </span>
                  <span className="text-sm sm:text-lg font-black font-mono text-slate-900 block">
                    {booking.boardingGroup}
                  </span>
                </div>
              </div>

            </div>

            {/* Bottom Barcode */}
            <div className="px-5 py-2 border-t border-slate-100 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <div className="flex items-end h-7 sm:h-8 gap-[2px]">
                  {[3, 1, 4, 1, 5, 2, 1, 4, 2, 3, 1, 2, 4, 1, 3, 2, 5, 1, 3, 2, 4, 1, 3, 2, 1, 4, 2, 3, 1].map(
                    (w, idx) => (
                      <div
                        key={idx}
                        className="bg-slate-900"
                        style={{
                          width: `${w}px`,
                          height: `${20 + (idx % 3) * 3}px`,
                        }}
                      />
                    )
                  )}
                </div>
                <span className="text-[9px] font-mono text-slate-500 ml-1">
                  ETKT: 016 7829410 • REF: {booking.pnr || '6X9K2P'}
                </span>
              </div>
              <span className="text-[9px] font-mono text-slate-400">
                ELECTRONIC TICKET • SEQ 042
              </span>
            </div>
          </div>

          {/* PERFORATION NOTCHES & LINE */}
          <div className="relative flex flex-col items-center justify-between w-0 z-20 pointer-events-none">
            <div className="absolute -top-3 -left-3 w-6 h-6 rounded-full bg-slate-950 border-r border-slate-800" />
            <div className="flex flex-col items-center justify-center h-full w-0 border-r-2 border-dashed border-slate-400" />
            <div className="absolute -bottom-3 -left-3 w-6 h-6 rounded-full bg-slate-950 border-r border-slate-800" />
          </div>

          {/* RIGHT PART: TICKET STUB (28% width) */}
          {/* Rotates about bottom left corner at half angle (4.5 deg) */}
          <div
            onMouseDown={handleMouseDown}
            onTouchStart={handleTouchStart}
            onClick={handleTear}
            title="Click or drag ticket stub to tear"
            className="w-[28%] h-full bg-slate-50 text-slate-900 rounded-r-2xl border border-l-0 border-dashed border-slate-300 p-3 sm:p-4 flex flex-col justify-between cursor-pointer select-none transition-all duration-700 ease-out shadow-xl z-20 hover:bg-slate-100"
            style={{
              transformOrigin: 'bottom left',
              transform: `translate(${rightTranslateX}px, ${rightTranslateY}px) rotate(${rightRotation}deg)`,
              opacity: isTorn ? 0.35 : 1,
            }}
          >
            {/* Header: Called "TICKET STUB" as requested */}
            <div className="pb-2 border-b border-slate-300 flex items-center justify-between shrink-0">
              <span className="text-[10px] sm:text-xs font-black font-mono uppercase tracking-wider text-slate-800">
                TICKET STUB
              </span>
              <span className="text-[10px] sm:text-xs font-mono font-bold text-slate-500">
                {booking.flightNumber}
              </span>
            </div>

            {/* Information Rows */}
            <div className="space-y-1.5 sm:space-y-2 text-xs font-mono flex-1 py-2 flex flex-col justify-around">
              <div>
                <span className="text-[8px] text-slate-400 uppercase block font-bold">NAME</span>
                <span className="text-[11px] sm:text-xs font-black text-slate-900 uppercase block truncate">
                  {booking.passengerName}
                </span>
              </div>

              <div className="flex justify-between">
                <div>
                  <span className="text-[8px] text-slate-400 uppercase block font-bold">FROM</span>
                  <span className="text-xs sm:text-sm font-black text-slate-900">{booking.departure.iata}</span>
                </div>
                <div className="text-right">
                  <span className="text-[8px] text-slate-400 uppercase block font-bold">TO</span>
                  <span className="text-xs sm:text-sm font-black text-slate-900">{booking.destination.iata}</span>
                </div>
              </div>

              <div className="flex justify-between">
                <div>
                  <span className="text-[8px] text-slate-400 uppercase block font-bold">GATE</span>
                  <span className="text-xs sm:text-sm font-black text-slate-900">{booking.gate}</span>
                </div>
                <div className="text-right">
                  <span className="text-[8px] text-slate-400 uppercase block font-bold">SEAT</span>
                  <span className="text-xs sm:text-sm font-black text-sky-600">{booking.seat}</span>
                </div>
              </div>

              <div className="flex justify-between">
                <div>
                  <span className="text-[8px] text-slate-400 uppercase block font-bold">CLASS</span>
                  <span className="text-[10px] font-bold text-slate-700">{classLetter}</span>
                </div>
                <div className="text-right">
                  <span className="text-[8px] text-slate-400 uppercase block font-bold">DATE</span>
                  <span className="text-[10px] font-bold text-slate-700">{departureDate}</span>
                </div>
              </div>
            </div>

            {/* Mini Barcode on stub */}
            <div className="pt-2 border-t border-slate-200 shrink-0">
              <div className="flex justify-center opacity-80">
                <div className="flex items-end h-5 gap-[2px]">
                  {[1, 3, 2, 1, 4, 1, 3, 2, 1, 3, 1, 2, 4, 2, 1, 3, 1, 2].map((w, i) => (
                    <div key={i} className="bg-slate-900" style={{ width: `${w}px`, height: '16px' }} />
                  ))}
                </div>
              </div>
              <div className="text-[8px] font-mono text-center text-slate-400 mt-1 uppercase">
                COUPON 1
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
