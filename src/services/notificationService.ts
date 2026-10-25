import { FlightBooking, FlightNotification } from '../types/flight';
import { playCabinChime } from './soundEffects';

/**
 * Manages system push notifications and generates realistic aviation alerts
 */

export async function requestNotificationPermission(): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return false;
  }
  if (Notification.permission === 'granted') {
    return true;
  }
  if (Notification.permission !== 'denied') {
    const perm = await Notification.requestPermission();
    return perm === 'granted';
  }
  return false;
}

export function sendSystemNotification(title: string, body: string) {
  if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
    try {
      new Notification(title, {
        body,
        icon: '/favicon.ico',
        tag: 'focusflight-alert',
      });
    } catch {
      // Ignore background restrictions
    }
  }
}

/**
 * Creates contextual weather reports based on airport data and flight conditions
 */
export function generateDepartureWeatherAlert(booking: FlightBooking): FlightNotification {
  const w = booking.departure.weather;
  return {
    id: 'dep-weather-' + Date.now(),
    timestamp: new Date(),
    type: 'weather',
    airportCode: booking.departure.iata,
    title: `Departure Weather: ${booking.departure.city} (${booking.departure.iata})`,
    message: `${w.condition}, ${w.tempC}°C (${w.tempF}°F). Winds ${w.windDirection} at ${w.windKts} kts. Visibility ${w.visibilityKm} km. Cleared for takeoff.`,
  };
}

export function generateArrivalWeatherAlert(booking: FlightBooking): FlightNotification {
  const w = booking.destination.weather;
  return {
    id: 'arr-weather-' + Date.now(),
    timestamp: new Date(),
    type: 'weather',
    airportCode: booking.destination.iata,
    title: `Destination Forecast: ${booking.destination.city} (${booking.destination.iata})`,
    message: `Expected on arrival: ${w.condition}, ${w.tempC}°C. Surface winds ${w.windDirection} at ${w.windKts} kts. Ceiling clear.`,
  };
}

export function generateEnRouteWeatherUpdate(progressPercent: number): FlightNotification {
  const conditions = [
    {
      title: 'Stratospheric Jetstream Update',
      message: 'Favorable tailwinds detected (+48 kts). Flight path clear of convective turbulence. Optimal focus conditions.',
    },
    {
      title: 'Upper Atmosphere Report',
      message: 'Passing over cloud layer at FL380. Smooth air ahead. Keep your attention focused.',
    },
    {
      title: 'Turbulence Advisory',
      message: 'Entering minor mountain wave turbulence. Fasten seatbelts, stay seated in your deep work zone.',
    },
    {
      title: 'Navigation Waypoint Cleared',
      message: 'Waypoint transition confirmed. Cruise velocity steady at Mach 0.84.',
    },
  ];

  const index = Math.min(conditions.length - 1, Math.floor((progressPercent / 100) * conditions.length));
  const selected = conditions[index];

  return {
    id: 'enroute-' + Date.now(),
    timestamp: new Date(),
    type: 'weather',
    title: selected.title,
    message: selected.message,
  };
}

export function generateMilestoneAlert(
  stage: 'takeoff' | 'cruise' | 'halfway' | 'descent' | 'approach' | 'touchdown',
  booking: FlightBooking
): FlightNotification {
  playCabinChime('dingdong');

  switch (stage) {
    case 'takeoff': {
      const msg = `Captain has applied takeoff thrust. Now climbing through 10,000 ft. Put devices on airplane mode and begin ${booking.taskTitle || 'focus'}.`;
      sendSystemNotification(`🛫 Airborne - ${booking.flightNumber}`, msg);
      return {
        id: 'ms-takeoff-' + Date.now(),
        timestamp: new Date(),
        type: 'boarding',
        title: `Takeoff Cleared • ${booking.flightNumber}`,
        message: msg,
        important: true,
      };
    }
    case 'cruise': {
      const msg = `Now cruising at 38,000 feet. Seatbelt sign turned off. Deep work flow state engaged.`;
      sendSystemNotification(`✈️ Cruising Altitude Reached`, msg);
      return {
        id: 'ms-cruise-' + Date.now(),
        timestamp: new Date(),
        type: 'atc',
        title: `Cruising Altitude Reached • FL380`,
        message: msg,
      };
    }
    case 'halfway': {
      const msg = `50% of the flight completed! Halfway to ${booking.destination.city}. Great momentum!`;
      sendSystemNotification(`⏱️ Halfway Point Reached`, msg);
      return {
        id: 'ms-halfway-' + Date.now(),
        timestamp: new Date(),
        type: 'milestone',
        title: `Halfway Point Reached`,
        message: msg,
      };
    }
    case 'descent': {
      const msg = `Beginning descent toward ${booking.destination.city} (${booking.destination.iata}). Prepare for arrival in final minutes.`;
      sendSystemNotification(`🛬 Top of Descent`, msg);
      return {
        id: 'ms-descent-' + Date.now(),
        timestamp: new Date(),
        type: 'boarding',
        title: `Top of Descent • Approaching ${booking.destination.iata}`,
        message: msg,
      };
    }
    case 'approach': {
      const msg = `Flight on final approach to Runway. Flaps extended, landing gear down. Bring your focus session to a close.`;
      sendSystemNotification(`🎯 Final Approach`, msg);
      return {
        id: 'ms-approach-' + Date.now(),
        timestamp: new Date(),
        type: 'atc',
        title: `Final Approach Clearance`,
        message: msg,
      };
    }
    case 'touchdown': {
      const msg = `Touchdown at ${booking.destination.city}! Welcome to ${booking.destination.name}. Flight completed successfully.`;
      sendSystemNotification(`🎉 Landed Safely!`, msg);
      return {
        id: 'ms-landed-' + Date.now(),
        timestamp: new Date(),
        type: 'boarding',
        title: `Touchdown! Welcome to ${booking.destination.city}`,
        message: msg,
        important: true,
      };
    }
  }
}
