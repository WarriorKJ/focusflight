export interface Airport {
  iata: string;
  icao: string;
  name: string;
  city: string;
  country: string;
  lat: number;
  lng: number;
  timezone: string;
  weather: {
    tempC: number;
    tempF: number;
    condition: 'Clear' | 'Sunny' | 'Partly Cloudy' | 'Rain' | 'Light Snow' | 'Fog' | 'Breezy';
    windKts: number;
    windDirection: string;
    visibilityKm: number;
  };
}

export interface Airline {
  id: string;
  name: string;
  code: string;
  callsign: string;
  primaryColor: string;
  accentColor: string;
  textColor: string;
  slogan: string;
  country: string;
}

export type CabinClass = 'Economy' | 'Premium Economy' | 'Business' | 'First Class';

export interface FlightBooking {
  id: string;
  flightNumber: string;
  pnr: string;
  departure: Airport;
  destination: Airport;
  airline: Airline;
  durationMinutes: number;
  passengerName: string;
  seat: string;
  gate: string;
  terminal: string;
  boardingGroup: string;
  cabinClass: CabinClass;
  taskTitle: string;
  distanceKm: number;
  scheduledDepartureTime: Date;
}

export type FlightStatus = 
  | 'BOOKING'
  | 'CHECKED_IN'
  | 'BOARDING'
  | 'TAXI'
  | 'CLIMBING'
  | 'CRUISING'
  | 'DESCENT'
  | 'APPROACH'
  | 'LANDED'
  | 'HOLDING';

export interface FlightNotification {
  id: string;
  timestamp: Date;
  type: 'boarding' | 'weather' | 'atc' | 'milestone';
  title: string;
  message: string;
  airportCode?: string;
  important?: boolean;
}
