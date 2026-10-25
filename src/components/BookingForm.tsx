import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Plane, MapPin, ArrowRightLeft, Compass, Wind, Thermometer, Check, Search, X } from 'lucide-react';
import { Airport, Airline, CabinClass, FlightBooking } from '../types/flight';
import { WORLD_AIRPORTS, POPULAR_ROUTES, searchAirports } from '../data/airports';
import { AIRLINES } from '../data/airlines';
import { calculateGreatCircleDistanceKm } from '../utils/geo';

interface BookingFormProps {
  onBookingConfirmed: (booking: FlightBooking) => void;
}

const CLASS_SEATS: Record<CabinClass, string[]> = {
  'First Class': ['1A', '1K', '2A', '2K'],
  'Business': ['11A', '12K', '14D', '15F'],
  'Premium Economy': ['21A', '21C', '22H', '23K'],
  'Economy': ['32A', '35F', '42B', '48E'],
};

export const BookingForm: React.FC<BookingFormProps> = ({ onBookingConfirmed }) => {
  // Airport state
  const [departure, setDeparture] = useState<Airport>(WORLD_AIRPORTS[0]); // JFK
  const [destination, setDestination] = useState<Airport>(WORLD_AIRPORTS[2]); // HND

  // Text inputs for keying in name, ICAO or IATA
  const [depQuery, setDepQuery] = useState(`${departure.iata} - ${departure.city}`);
  const [destQuery, setDestQuery] = useState(`${destination.iata} - ${destination.city}`);

  const [showDepDropdown, setShowDepDropdown] = useState(false);
  const [showDestDropdown, setShowDestDropdown] = useState(false);

  // Airline & duration
  const [selectedAirlineId, setSelectedAirlineId] = useState('singapore');
  const [durationMinutes, setDurationMinutes] = useState(25);
  const [customDuration, setCustomDuration] = useState('');

  // Passenger & Focus details
  const [passengerName, setPassengerName] = useState('Jasper Khoo');
  const [focusObjective, setFocusObjective] = useState('');
  const [cabinClass, setCabinClass] = useState<CabinClass>('First Class');
  const [seat, setSeat] = useState('1A');

  const depContainerRef = useRef<HTMLDivElement>(null);
  const destContainerRef = useRef<HTMLDivElement>(null);

  // Filtered airport lists
  const depMatches = useMemo(() => searchAirports(depQuery), [depQuery]);
  const destMatches = useMemo(() => searchAirports(destQuery), [destQuery]);

  // Update seat when cabin class changes
  const handleClassChange = (newClass: CabinClass) => {
    setCabinClass(newClass);
    const availableSeats = CLASS_SEATS[newClass];
    if (!availableSeats.includes(seat)) {
      setSeat(availableSeats[0]);
    }
  };

  const handleSelectDep = (airport: Airport) => {
    setDeparture(airport);
    setDepQuery(`${airport.iata} - ${airport.city}`);
    setShowDepDropdown(false);
  };

  const handleSelectDest = (airport: Airport) => {
    setDestination(airport);
    setDestQuery(`${airport.iata} - ${airport.city}`);
    setShowDestDropdown(false);
  };

  const handleSwapAirports = () => {
    const temp = departure;
    setDeparture(destination);
    setDestination(temp);
    setDepQuery(`${destination.iata} - ${destination.city}`);
    setDestQuery(`${temp.iata} - ${temp.city}`);
  };

  const handleApplyRoute = (fromIata: string, toIata: string, min: number) => {
    const fromA = WORLD_AIRPORTS.find((a) => a.iata === fromIata);
    const toA = WORLD_AIRPORTS.find((a) => a.iata === toIata);
    if (fromA && toA) {
      setDeparture(fromA);
      setDestination(toA);
      setDepQuery(`${fromA.iata} - ${fromA.city}`);
      setDestQuery(`${toA.iata} - ${toA.city}`);
      setDurationMinutes(min);
      setCustomDuration('');
    }
  };

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (depContainerRef.current && !depContainerRef.current.contains(e.target as Node)) {
        setShowDepDropdown(false);
      }
      if (destContainerRef.current && !destContainerRef.current.contains(e.target as Node)) {
        setShowDestDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const airline = AIRLINES.find((a) => a.id === selectedAirlineId) || AIRLINES[0];

  const distanceKm = calculateGreatCircleDistanceKm(
    departure.lat,
    departure.lng,
    destination.lat,
    destination.lng
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (departure.iata === destination.iata) {
      alert('Please select two distinct departure and destination airports.');
      return;
    }

    const duration = customDuration ? parseInt(customDuration, 10) : durationMinutes;
    if (isNaN(duration) || duration < 1) {
      alert('Please enter a valid flight duration in minutes.');
      return;
    }

    const flightNum = `${airline.code} ${Math.floor(100 + Math.random() * 899)}`;
    const gates = ['A12', 'B04', 'C18', 'D22', 'E07', 'F14'];
    const randomGate = gates[Math.floor(Math.random() * gates.length)];
    const pnr = Math.random().toString(36).substring(2, 8).toUpperCase();

    const booking: FlightBooking = {
      id: 'flight-' + Date.now(),
      flightNumber: flightNum,
      pnr,
      departure,
      destination,
      airline,
      durationMinutes: duration,
      passengerName: passengerName.trim() || 'Jasper Khoo',
      seat: seat || CLASS_SEATS[cabinClass][0],
      gate: randomGate,
      terminal: randomGate.charAt(0),
      boardingGroup: cabinClass === 'First Class' ? 'Group 1' : cabinClass === 'Business' ? 'Group 2' : 'Group 3',
      cabinClass,
      taskTitle: focusObjective.trim(),
      distanceKm,
      scheduledDepartureTime: new Date(),
    };

    onBookingConfirmed(booking);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header Banner */}
      <div className="text-center mb-8">
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-white tracking-tight">
          Book Your Flight
        </h1>
        <p className="text-slate-400 text-sm sm:text-base mt-2 max-w-xl mx-auto">
          Key in your departure and destination airports, choose your airline, and launch your focus timer.
        </p>
      </div>

      {/* Featured Routes */}
      <div className="mb-6">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2.5 block">
          Popular Routes
        </span>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
          {POPULAR_ROUTES.map((route) => (
            <button
              key={`${route.from}-${route.to}`}
              type="button"
              onClick={() => handleApplyRoute(route.from, route.to, route.min)}
              className={`p-2.5 rounded-xl border text-left transition-all ${
                departure.iata === route.from && destination.iata === route.to
                  ? 'border-sky-500 bg-sky-500/15 text-white shadow-sm'
                  : 'border-slate-800 bg-slate-900/60 hover:bg-slate-800 hover:border-slate-700 text-slate-300'
              }`}
            >
              <div className="flex items-center justify-between text-xs font-bold font-mono">
                <span>{route.from}</span>
                <span className="text-slate-500">→</span>
                <span>{route.to}</span>
              </div>
              <div className="text-[11px] text-slate-400 truncate mt-1">{route.label}</div>
              <div className="text-[10px] text-sky-400 font-semibold mt-0.5">{route.min}m</div>
            </button>
          ))}
        </div>
      </div>

      {/* Main Booking Form */}
      <form
        onSubmit={handleSubmit}
        className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 sm:p-8 shadow-2xl backdrop-blur-md space-y-6"
      >
        {/* Origin & Destination: Key in Airport Name, ICAO or IATA */}
        <div className="grid grid-cols-1 md:grid-cols-11 gap-3 items-start">
          
          {/* Departure Airport Search Input */}
          <div ref={depContainerRef} className="md:col-span-5 space-y-1.5 relative">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
              <span>Departure Airport</span>
              <span className="text-[10px] text-emerald-400 font-normal">Origin</span>
            </label>
            <div className="relative">
              <input
                type="text"
                value={depQuery}
                onChange={(e) => {
                  setDepQuery(e.target.value);
                  setShowDepDropdown(true);
                }}
                onFocus={() => setShowDepDropdown(true)}
                placeholder="Key in name, ICAO (e.g. KJFK) or IATA (JFK)"
                className="w-full bg-slate-950 border border-slate-700 focus:border-sky-500 rounded-xl pl-10 pr-4 py-3 text-white font-medium text-sm focus:outline-hidden"
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              {depQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setDepQuery('');
                    setShowDepDropdown(true);
                  }}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Departure Autocomplete Dropdown */}
            {showDepDropdown && (
              <div className="absolute left-0 right-0 top-full mt-1 bg-slate-950 border border-slate-700 rounded-xl shadow-2xl z-50 max-h-56 overflow-y-auto divide-y divide-slate-800">
                {depMatches.length === 0 ? (
                  <div className="p-3 text-xs text-slate-400">No airport found for "{depQuery}"</div>
                ) : (
                  depMatches.map((a) => (
                    <button
                      key={`dep-${a.iata}`}
                      type="button"
                      onClick={() => handleSelectDep(a)}
                      className="w-full p-2.5 text-left hover:bg-slate-800/80 transition-colors flex items-center justify-between text-xs"
                    >
                      <div>
                        <div className="font-bold text-white flex items-center gap-1.5">
                          <span className="font-mono text-sky-400">{a.iata}</span>
                          <span className="text-[10px] font-mono text-slate-500">({a.icao})</span>
                          <span>• {a.city}, {a.country}</span>
                        </div>
                        <div className="text-[11px] text-slate-400 truncate">{a.name}</div>
                      </div>
                      {departure.iata === a.iata && <Check className="w-4 h-4 text-sky-400 shrink-0" />}
                    </button>
                  ))
                )}
              </div>
            )}

            {/* Departure Weather Preview */}
            <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-950/60 p-2 rounded-lg border border-slate-800/80">
              <Thermometer className="w-3.5 h-3.5 text-sky-400 shrink-0" />
              <span className="text-slate-300 font-semibold">{departure.weather.tempC}°C</span>
              <span>•</span>
              <span>{departure.weather.condition}</span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Wind className="w-3 h-3 text-slate-400" />
                {departure.weather.windKts} kts {departure.weather.windDirection}
              </span>
            </div>
          </div>

          {/* Swap Button */}
          <div className="md:col-span-1 flex justify-center pt-7 pb-2 md:pb-0">
            <button
              type="button"
              onClick={handleSwapAirports}
              title="Swap Departure and Destination"
              className="p-3 rounded-full bg-slate-800 hover:bg-sky-500 text-slate-300 hover:text-white transition-all shadow-md active:scale-90"
            >
              <ArrowRightLeft className="w-4 h-4" />
            </button>
          </div>

          {/* Destination Airport Search Input */}
          <div ref={destContainerRef} className="md:col-span-5 space-y-1.5 relative">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
              <span>Destination Airport</span>
              <span className="text-[10px] text-amber-400 font-normal">Arrival</span>
            </label>
            <div className="relative">
              <input
                type="text"
                value={destQuery}
                onChange={(e) => {
                  setDestQuery(e.target.value);
                  setShowDestDropdown(true);
                }}
                onFocus={() => setShowDestDropdown(true)}
                placeholder="Key in name, ICAO (e.g. RJTT) or IATA (HND)"
                className="w-full bg-slate-950 border border-slate-700 focus:border-sky-500 rounded-xl pl-10 pr-4 py-3 text-white font-medium text-sm focus:outline-hidden"
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              {destQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setDestQuery('');
                    setShowDestDropdown(true);
                  }}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Destination Autocomplete Dropdown */}
            {showDestDropdown && (
              <div className="absolute left-0 right-0 top-full mt-1 bg-slate-950 border border-slate-700 rounded-xl shadow-2xl z-50 max-h-56 overflow-y-auto divide-y divide-slate-800">
                {destMatches.length === 0 ? (
                  <div className="p-3 text-xs text-slate-400">No airport found for "{destQuery}"</div>
                ) : (
                  destMatches.map((a) => (
                    <button
                      key={`dest-${a.iata}`}
                      type="button"
                      onClick={() => handleSelectDest(a)}
                      className="w-full p-2.5 text-left hover:bg-slate-800/80 transition-colors flex items-center justify-between text-xs"
                    >
                      <div>
                        <div className="font-bold text-white flex items-center gap-1.5">
                          <span className="font-mono text-amber-400">{a.iata}</span>
                          <span className="text-[10px] font-mono text-slate-500">({a.icao})</span>
                          <span>• {a.city}, {a.country}</span>
                        </div>
                        <div className="text-[11px] text-slate-400 truncate">{a.name}</div>
                      </div>
                      {destination.iata === a.iata && <Check className="w-4 h-4 text-sky-400 shrink-0" />}
                    </button>
                  ))
                )}
              </div>
            )}

            {/* Destination Weather Preview */}
            <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-950/60 p-2 rounded-lg border border-slate-800/80">
              <Thermometer className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span className="text-slate-300 font-semibold">{destination.weather.tempC}°C</span>
              <span>•</span>
              <span>{destination.weather.condition}</span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Wind className="w-3 h-3 text-slate-400" />
                {destination.weather.windKts} kts {destination.weather.windDirection}
              </span>
            </div>
          </div>
        </div>

        {/* Great Circle Distance Badge */}
        <div className="bg-slate-950/80 border border-slate-800 p-3 rounded-xl flex flex-wrap items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-slate-300">
            <Compass className="w-4 h-4 text-sky-400" />
            <span className="font-semibold">Distance:</span>
            <span className="text-sky-300 font-mono font-bold">{distanceKm.toLocaleString()} km</span>
            <span className="text-slate-500 font-mono">
              ({Math.round(distanceKm * 0.539957).toLocaleString()} NM)
            </span>
          </div>
          <span className="text-slate-400">
            {departure.city} ({departure.iata}) ✈ {destination.city} ({destination.iata})
          </span>
        </div>

        {/* Airline Selector ("Select Airline" as requested, no & livery) */}
        <div className="space-y-2">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-400 block">
            Select Airline
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
            {AIRLINES.map((al) => {
              const isSelected = al.id === selectedAirlineId;
              return (
                <button
                  key={al.id}
                  type="button"
                  onClick={() => setSelectedAirlineId(al.id)}
                  className={`p-3 rounded-xl border text-left flex items-center justify-between transition-all ${
                    isSelected
                      ? 'border-sky-500 bg-slate-800/90 shadow-md ring-1 ring-sky-500'
                      : 'border-slate-800 bg-slate-950/70 hover:bg-slate-800/50 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2.5 overflow-hidden">
                    <div
                      className="w-3.5 h-3.5 rounded-full shrink-0 shadow-xs"
                      style={{ backgroundColor: al.primaryColor }}
                    />
                    <div className="truncate">
                      <div className="text-xs font-bold text-white truncate">{al.name}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{al.code} • {al.country}</div>
                    </div>
                  </div>
                  {isSelected && <Check className="w-4 h-4 text-sky-400 shrink-0 ml-1" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Timer Duration Selection - Clean buttons without "sprint", "pomodoro", "deep work" etc */}
        <div className="space-y-2">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
            <span>Focus Duration</span>
            <span className="text-sky-400 font-mono font-bold">
              {customDuration ? `${customDuration} min` : `${durationMinutes} min`}
            </span>
          </label>

          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {[15, 25, 45, 60, 90, 120].map((mins) => (
              <button
                key={mins}
                type="button"
                onClick={() => {
                  setDurationMinutes(mins);
                  setCustomDuration('');
                }}
                className={`py-3 px-3 rounded-xl border text-center transition-all ${
                  durationMinutes === mins && !customDuration
                    ? 'border-sky-500 bg-sky-500/20 text-white font-bold shadow-sm'
                    : 'border-slate-800 bg-slate-950 hover:bg-slate-800 text-slate-300'
                }`}
              >
                <div className="text-sm font-black font-mono">{mins}m</div>
              </button>
            ))}
          </div>

          {/* Custom Duration Input */}
          <div className="pt-2 flex items-center gap-3">
            <span className="text-xs text-slate-400">Or custom:</span>
            <input
              type="number"
              min="1"
              max="240"
              placeholder="e.g. 50"
              value={customDuration}
              onChange={(e) => setCustomDuration(e.target.value)}
              className="w-24 bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-hidden focus:border-sky-500 font-mono"
            />
            <span className="text-xs text-slate-400">minutes</span>
          </div>
        </div>

        {/* Passenger Name & Focus Objective */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400 block">
              Passenger Name
            </label>
            <input
              type="text"
              value={passengerName}
              onChange={(e) => setPassengerName(e.target.value)}
              placeholder="Jasper Khoo"
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-hidden focus:border-sky-500"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400 block">
              Focus Objective
            </label>
            <input
              type="text"
              value={focusObjective}
              onChange={(e) => setFocusObjective(e.target.value)}
              placeholder="e.g. Code Review, Reading, Design Sprint"
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-hidden focus:border-sky-500"
            />
          </div>
        </div>

        {/* Cabin Class & Dynamic Class-Specific Seat Codes */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <div className="space-y-1">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400 block">
              Cabin Class
            </label>
            <select
              value={cabinClass}
              onChange={(e) => handleClassChange(e.target.value as CabinClass)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-hidden focus:border-sky-500 cursor-pointer"
            >
              <option value="First Class">First Class</option>
              <option value="Business">Business Class</option>
              <option value="Premium Economy">Premium Economy</option>
              <option value="Economy">Economy</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400 block">
              Seat Selection ({cabinClass})
            </label>
            <div className="grid grid-cols-4 gap-2">
              {CLASS_SEATS[cabinClass].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSeat(s)}
                  className={`py-2 rounded-lg border text-center text-xs font-mono font-bold transition-all ${
                    seat === s
                      ? 'border-sky-500 bg-sky-500/20 text-white'
                      : 'border-slate-800 bg-slate-950 hover:bg-slate-800 text-slate-400'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <div className="pt-4">
          <button
            type="submit"
            className="w-full py-4 rounded-xl bg-gradient-to-r from-sky-500 via-blue-600 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-extrabold text-base tracking-wide shadow-xl hover:shadow-sky-500/25 active:scale-[0.99] transition-all flex items-center justify-center gap-3 cursor-pointer"
          >
            <Plane className="w-5 h-5 transform -rotate-45" />
            <span>Generate Flight Boarding Pass</span>
          </button>
        </div>
      </form>
    </div>
  );
};
