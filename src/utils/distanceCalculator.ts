import { TrackerPoint, VehicleSettings, Contact } from '../types/dairy';

/**
 * Pure Haversine formula calculation (Single Source of Truth for GPS distance)
 * Returns distance in kilometers (km)
 */
export function calculateHaversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  if (lat1 === lat2 && lon1 === lon2) return 0;

  const R = 6371; // Earth radius in km
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLon = (lon2 - lon1) * rad;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Filter consecutive GPS points according to WARNING 7:
 * - Accuracy <= 50m
 * - Jitter filter: consecutive points must be >= 10m apart
 * - Speed filter: consecutive points <= 120 km/h (filter GPS teleports)
 */
export function shouldAccumulateGpsPoint(
  prevPoint: TrackerPoint | null,
  newPoint: TrackerPoint
): { valid: boolean; distanceKm: number; reason?: string } {
  // 1. Accuracy filter
  if (newPoint.accuracy > 50) {
    return { valid: false, distanceKm: 0, reason: 'Accuracy worse than 50m' };
  }

  if (!prevPoint) {
    return { valid: true, distanceKm: 0 };
  }

  // 2. Haversine distance
  const distKm = calculateHaversineDistanceKm(
    prevPoint.latitude,
    prevPoint.longitude,
    newPoint.latitude,
    newPoint.longitude
  );

  const distMeters = distKm * 1000;

  // 3. Jitter filter: ignore tiny movements under 10 meters
  if (distMeters < 10) {
    return { valid: false, distanceKm: 0, reason: 'Movement under 10m (jitter)' };
  }

  // 4. Glitch / Speed filter: max 120 km/h
  const timeDeltaHours = Math.max(0.0001, (newPoint.timestamp - prevPoint.timestamp) / (1000 * 3600));
  const speedKmH = distKm / timeDeltaHours;
  if (speedKmH > 120) {
    return { valid: false, distanceKm: 0, reason: 'Speed > 120 km/h (GPS jump glitch)' };
  }

  return { valid: true, distanceKm: distKm };
}

/**
 * Accumulates total distance across an array of GPS tracker points
 */
export function calculateTrackPathKm(points: TrackerPoint[]): number {
  if (points.length < 2) return 0;
  let totalKm = 0;
  let prevValid: TrackerPoint = points[0];

  for (let i = 1; i < points.length; i++) {
    const cur = points[i];
    const check = shouldAccumulateGpsPoint(prevValid, cur);
    if (check.valid && check.distanceKm > 0) {
      totalKm += check.distanceKm;
      prevValid = cur;
    }
  }

  return Math.round(totalKm * 100) / 100;
}

/**
 * Calculates distance from a given point to a customer's saved coordinates
 */
export function calculateDistanceToCustomerKm(
  currentLat: number,
  currentLon: number,
  customer: Contact
): number | null {
  if (customer.latitude == null || customer.longitude == null) {
    return null;
  }
  const dist = calculateHaversineDistanceKm(
    currentLat,
    currentLon,
    customer.latitude,
    customer.longitude
  );
  return Math.round(dist * 100) / 100;
}

export interface FuelEstimateResult {
  fuelType: 'petrol' | 'diesel';
  fuelRateKmPerLiter?: number;
  fuelPricePerLiter?: number;
  estimatedLiters: number | null;
  estimatedCost: number | null;
  isConfigured: boolean;
}

/**
 * Calculates fuel estimation according to WARNING 8:
 * - Fuel used = Total km ÷ Fuel rate (km/L)
 * - Fuel cost = Fuel used × Fuel price per liter
 */
export function calculateFuelEstimate(
  totalKm: number,
  vehicleSettings?: VehicleSettings
): FuelEstimateResult {
  const fuelType = vehicleSettings?.fuelType || 'petrol';
  const fuelRate = vehicleSettings?.fuelRateKmPerLiter;
  const fuelPrice = vehicleSettings?.fuelPricePerLiter;

  if (!fuelRate || fuelRate <= 0) {
    return {
      fuelType,
      fuelRateKmPerLiter: undefined,
      fuelPricePerLiter: fuelPrice,
      estimatedLiters: null,
      estimatedCost: null,
      isConfigured: false,
    };
  }

  const estimatedLiters = totalKm / fuelRate;
  const estimatedCost = fuelPrice && fuelPrice > 0 ? estimatedLiters * fuelPrice : null;

  return {
    fuelType,
    fuelRateKmPerLiter: fuelRate,
    fuelPricePerLiter: fuelPrice,
    estimatedLiters: Math.round(estimatedLiters * 100) / 100,
    estimatedCost: estimatedCost !== null ? Math.round(estimatedCost) : null,
    isConfigured: fuelPrice != null && fuelPrice > 0,
  };
}
