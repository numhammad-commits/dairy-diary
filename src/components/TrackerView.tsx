import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  ArrowLeft, 
  Navigation, 
  Play, 
  Square, 
  Pause, 
  Fuel, 
  MapPin, 
  Compass, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  ExternalLink, 
  Search, 
  RotateCcw,
  Sparkles,
  Settings as SettingsIcon,
  ChevronRight
} from 'lucide-react';
import { Contact, BusinessSettings, TrackerPoint, TrackerSession } from '../types/dairy';
import { 
  calculateTrackPathKm, 
  shouldAccumulateGpsPoint, 
  calculateDistanceToCustomerKm, 
  calculateFuelEstimate 
} from '../utils/distanceCalculator';
import { loadPersistedTrackerSessions, savePersistedTrackerSessions } from '../utils/storage';

interface TrackerViewProps {
  contacts: Contact[];
  businessSettings: BusinessSettings;
  onBack: () => void;
  onOpenSettings: () => void;
  showToast?: (message: string) => void;
  pendingRouteContactId?: string | null;
  onSaveCustomRoute?: (contactId: string, route: { lat: number; lng: number }[]) => void;
}

export const TrackerView: React.FC<TrackerViewProps> = ({
  contacts,
  businessSettings,
  onBack,
  onOpenSettings,
  showToast,
  pendingRouteContactId,
  onSaveCustomRoute,
}) => {
  // 1. Tracking State
  const [isTracking, setIsTracking] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [currentPoints, setCurrentPoints] = useState<TrackerPoint[]>([]);
  const [currentSessionKm, setCurrentSessionKm] = useState<number>(0);
  const [currentLocation, setCurrentLocation] = useState<TrackerPoint | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [gpsStatus, setGpsStatus] = useState<'idle' | 'waiting' | 'active' | 'denied'>('idle');
  
  // Timer for active session
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const timerRef = useRef<any>(null);

  // Geolocation watch id
  const watchIdRef = useRef<number | null>(null);

  // Screen Wake Lock — keeps the screen from auto-locking while tracking is active and
  // Dairy Diary stays the foregrounded tab. The API itself auto-releases the lock the
  // instant the document is hidden (switching apps, screen off via power button), so
  // re-acquiring on return is handled by the visibilitychange effect further below —
  // there is no way to make GPS keep recording while the app is fully backgrounded.
  const wakeLockRef = useRef<any>(null);

  const requestWakeLock = async () => {
    try {
      if ('wakeLock' in navigator) {
        wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
      } else if (showToast) {
        showToast("Keep your screen on manually — this device doesn't support auto screen lock.");
      }
    } catch (err) {
      console.warn('Wake Lock request failed:', err);
    }
  };

  const releaseWakeLock = async () => {
    try {
      if (wakeLockRef.current) await wakeLockRef.current.release();
    } catch {
      // ignore
    }
    wakeLockRef.current = null;
  };

  // Permission prompt modal (WARNING 5: Ask explanation once clearly)
  const [showPermissionModal, setShowPermissionModal] = useState<boolean>(false);

  // 2. Filter mode: 'all' | 'area' | 'customer'
  const [filterMode, setFilterMode] = useState<'all' | 'area' | 'customer'>('all');
  const [selectedArea, setSelectedArea] = useState<string>('All');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [customerSearch, setCustomerSearch] = useState<string>('');

  // 3. Saved Sessions
  const [sessions, setSessions] = useState<TrackerSession[]>(() => loadPersistedTrackerSessions());

  // Distinct areas from contacts
  const availableAreas = useMemo(() => {
    const set = new Set<string>();
    contacts.forEach((c) => {
      if (c.area && c.area.trim()) {
        set.add(c.area.trim());
      }
    });
    return Array.from(set);
  }, [contacts]);

  // Selected Customer details
  const selectedCustomer = useMemo(() => {
    return contacts.find((c) => c.id === selectedCustomerId) || null;
  }, [contacts, selectedCustomerId]);

  // Filtered customer list for the customer picker
  const filteredCustomers = useMemo(() => {
    if (!customerSearch.trim()) return contacts;
    const q = customerSearch.toLowerCase().trim();
    return contacts.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.address && c.address.toLowerCase().includes(q)) ||
        (c.area && c.area.toLowerCase().includes(q)) ||
        c.phone.includes(q)
    );
  }, [contacts, customerSearch]);

  // Timer counter effect
  useEffect(() => {
    if (isTracking && !isPaused) {
      timerRef.current = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isTracking, isPaused]);

  // Pre-link to the customer "Record Custom Route" was tapped for (ContactDetailModal).
  useEffect(() => {
    if (pendingRouteContactId) {
      setFilterMode('customer');
      setSelectedCustomerId(pendingRouteContactId);
    }
  }, [pendingRouteContactId]);

  // Re-acquire the wake lock when returning to the tab (the API auto-releases it
  // whenever the document goes hidden — that's standard, not a bug to patch around).
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && isTracking && !wakeLockRef.current) {
        requestWakeLock();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTracking]);

  // Handle GPS start
  const handleStartTrackingClick = () => {
    if (!navigator.geolocation) {
      setGpsError('Geolocation is not supported by your browser.');
      setGpsStatus('denied');
      return;
    }

    // Show clear privacy & purpose dialog (WARNING 5)
    setShowPermissionModal(true);
  };

  const handleConfirmStartTracking = () => {
    setShowPermissionModal(false);
    setGpsError(null);
    setGpsStatus('waiting');
    setIsTracking(true);
    setIsPaused(false);
    setCurrentPoints([]);
    setCurrentSessionKm(0);
    setElapsedSeconds(0);

    const id = navigator.geolocation.watchPosition(
      (position) => {
        setGpsStatus('active');
        setGpsError(null);

        const newPoint: TrackerPoint = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          timestamp: position.timestamp || Date.now(),
          accuracy: position.coords.accuracy,
          speed: position.coords.speed,
        };

        setCurrentLocation(newPoint);

        // Update path & accumulate distance with WARNING 7 filtering
        setCurrentPoints((prev) => {
          if (prev.length === 0) {
            return [newPoint];
          }
          const lastValid = prev[prev.length - 1];
          const check = shouldAccumulateGpsPoint(lastValid, newPoint);

          if (check.valid && check.distanceKm > 0) {
            setCurrentSessionKm((km) => Math.round((km + check.distanceKm) * 100) / 100);
            return [...prev, newPoint];
          }
          return prev;
        });
      },
      (error) => {
        console.warn('Geolocation watch error:', error);
        if (error.code === error.PERMISSION_DENIED) {
          setGpsStatus('denied');
          setGpsError('Location permission denied. Please allow location access in your browser settings.');
          setIsTracking(false);
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          setGpsStatus('waiting');
          setGpsError('Waiting for GPS signal... (Check device location settings)');
        } else {
          setGpsStatus('waiting');
          setGpsError('Searching for GPS connection...');
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );

    watchIdRef.current = id;
    requestWakeLock();
    if (showToast) showToast('Delivery tracking started');
  };

  // Pause / Resume
  const handleTogglePause = () => {
    setIsPaused((prev) => {
      const next = !prev;
      if (showToast) showToast(next ? 'Tracking paused' : 'Tracking resumed');
      return next;
    });
  };

  // Stop & Save
  const handleStopTracking = () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    releaseWakeLock();

    setIsTracking(false);
    setIsPaused(false);
    setGpsStatus('idle');

    if (currentSessionKm > 0 || currentPoints.length > 0) {
      const fuelInfo = calculateFuelEstimate(currentSessionKm, businessSettings.vehicleSettings);
      const newSession: TrackerSession = {
        id: `trk-${Date.now()}`,
        startTime: new Date(Date.now() - elapsedSeconds * 1000).toISOString(),
        endTime: new Date().toISOString(),
        totalKm: currentSessionKm,
        fuelConsumedLiters: fuelInfo.estimatedLiters || undefined,
        fuelCost: fuelInfo.estimatedCost || undefined,
        pathPoints: currentPoints,
        area: selectedArea !== 'All' ? selectedArea : undefined,
        contactId: pendingRouteContactId || undefined,
      };

      const updatedSessions = [newSession, ...sessions];
      setSessions(updatedSessions);
      savePersistedTrackerSessions(updatedSessions);

      if (pendingRouteContactId && currentPoints.length > 0 && onSaveCustomRoute) {
        onSaveCustomRoute(
          pendingRouteContactId,
          currentPoints.map((p) => ({ lat: p.latitude, lng: p.longitude }))
        );
        if (showToast) showToast('Custom route saved for this customer');
      }

      if (showToast) {
        showToast(`Delivery session saved: ${currentSessionKm.toFixed(2)} km`);
      }
    } else {
      if (showToast) showToast('Tracking stopped');
    }
  };

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      releaseWakeLock();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Format seconds to HH:MM:SS
  const formatTimer = (totalSec: number) => {
    const hrs = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;
    if (hrs > 0) {
      return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Calculate today's historical sessions distance
  const todayHistoricalKm = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    return sessions
      .filter((s) => s.startTime.startsWith(todayStr))
      .reduce((sum, s) => sum + s.totalKm, 0);
  }, [sessions]);

  // Total display km based on filter mode
  const displayedDistanceKm = useMemo(() => {
    if (filterMode === 'all') {
      return Math.round((currentSessionKm + todayHistoricalKm) * 100) / 100;
    }
    if (filterMode === 'area') {
      if (selectedArea === 'All') {
        return Math.round((currentSessionKm + todayHistoricalKm) * 100) / 100;
      }
      // Calculate area historical + current
      const areaHist = sessions
        .filter((s) => s.area === selectedArea)
        .reduce((sum, s) => sum + s.totalKm, 0);
      const currentArea = selectedArea === 'All' ? currentSessionKm : currentSessionKm;
      return Math.round((currentArea + areaHist) * 100) / 100;
    }
    if (filterMode === 'customer' && selectedCustomer) {
      // Distance from current location to customer's saved coordinates
      if (currentLocation && selectedCustomer.latitude != null && selectedCustomer.longitude != null) {
        const dist = calculateDistanceToCustomerKm(
          currentLocation.latitude,
          currentLocation.longitude,
          selectedCustomer
        );
        return dist ?? 0;
      }
      return 0;
    }
    return currentSessionKm;
  }, [filterMode, selectedArea, selectedCustomer, currentSessionKm, todayHistoricalKm, sessions, currentLocation]);

  // Fuel Estimate calculation for displayed km
  const fuelEstimate = useMemo(() => {
    return calculateFuelEstimate(displayedDistanceKm, businessSettings.vehicleSettings);
  }, [displayedDistanceKm, businessSettings.vehicleSettings]);

  return (
    <div className="flex-1 min-h-0 flex flex-col h-full bg-transparent relative select-none">
      {/* 1. Header Bar (#1E5631 Theme) */}
      <div className="bg-[#1B4332]/90 backdrop-blur-md text-white px-4 py-3 flex items-center justify-between shrink-0 border-b border-white/10 z-30">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="p-1.5 hover:bg-white/10 active:bg-white/20 rounded-lg transition-colors cursor-pointer text-white"
            title="Back to Home"
            aria-label="Back to Home"
          >
            <ArrowLeft className="w-5 h-5 stroke-[2.5]" />
          </button>
          <div>
            <h1 className="text-base font-extrabold tracking-tight text-white flex items-center gap-2 text-glass-lift">
              <Navigation className="w-4 h-4 fill-emerald-300 text-emerald-300" />
              <span>Delivery Tracker</span>
            </h1>
            <p className="text-[10px] text-[#C8E6C9] font-medium leading-none">
              Live GPS · Distance · Fuel Estimation
            </p>
          </div>
        </div>

        {/* Live GPS Status Pill */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-white/15 border border-white/20">
          {isTracking ? (
            isPaused ? (
              <>
                <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                <span className="text-amber-200">Paused</span>
              </>
            ) : gpsStatus === 'active' ? (
              <>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                <span className="text-emerald-200">GPS Live</span>
              </>
            ) : (
              <>
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
                <span className="text-amber-200">Searching</span>
              </>
            )
          ) : (
            <>
              <span className="w-2 h-2 rounded-full bg-white/40"></span>
              <span className="text-white/80">Idle</span>
            </>
          )}
        </div>
      </div>

      {/* 2. Scrollable Body */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
        {/* Error / Offline Alert Banner (WARNING 9) */}
        {gpsError && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 flex items-start gap-2.5 text-amber-800 shadow-2xs">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="flex-1 text-xs">
              <p className="font-bold text-amber-900">{gpsError}</p>
              <p className="text-[10px] text-amber-700 mt-0.5">
                Ensure device location / GPS is turned ON and permissions are allowed.
              </p>
            </div>
          </div>
        )}

        {/* Hero Odometer & Tracking Control Card */}
        <div className="glass-card rounded-3xl p-5 shadow-xs border border-[#D6E9E1] relative overflow-hidden text-[#163B32]">
          {/* Subtle Watermark Drop */}
          <div className="absolute right-[-10px] bottom-[-10px] opacity-5 pointer-events-none">
            <Compass className="w-36 h-36 text-emerald-950" />
          </div>

          <div className="relative z-10 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#55756D]">
                {filterMode === 'customer'
                  ? 'Straight Distance to Customer'
                  : filterMode === 'area'
                  ? `Distance in ${selectedArea}`
                  : 'Total Distance Recorded'}
              </span>
              {isTracking && (
                <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-[#0B8F68] bg-[#E1F3EA] px-2 py-0.5 rounded-lg border border-[#D6E9E1]">
                  <Clock className="w-3 h-3 text-[#0B8F68]" />
                  <span>{formatTimer(elapsedSeconds)}</span>
                </div>
              )}
            </div>

            {/* Odometer Display */}
            <div className="my-3">
              <div className="flex items-baseline gap-2">
                <span className="text-4xl sm:text-5xl font-black tracking-tight font-mono text-[#163B32]">
                  {displayedDistanceKm.toFixed(2)}
                </span>
                <span className="text-lg font-bold text-[#0B8F68]">km</span>
              </div>
              <p className="text-[11px] text-[#55756D] font-medium mt-1">
                {isTracking
                  ? isPaused
                    ? '⏸ Tracking is currently paused.'
                    : `Active tracking · ${currentPoints.length} GPS points logged`
                  : 'Tap Start Tracking to count kilometers as you deliver.'}
              </p>
            </div>

            {/* Live GPS Coordinates Pill (when available) */}
            {currentLocation && (
              <div className="text-[10px] text-[#55756D] font-mono bg-slate-50 rounded-xl px-2.5 py-1 mb-3 inline-flex items-center gap-2 max-w-fit border border-[#D6E9E1]">
                <MapPin className="w-3 h-3 text-[#0B8F68] shrink-0" />
                <span>
                  Lat: {currentLocation.latitude.toFixed(5)}, Lon: {currentLocation.longitude.toFixed(5)}
                </span>
                <span className="text-[#0B8F68] font-bold">
                  (±{Math.round(currentLocation.accuracy)}m)
                </span>
              </div>
            )}

            {/* Control Buttons */}
            <div className="pt-2 border-t border-[#D6E9E1] flex items-center gap-2">
              {!isTracking ? (
                <button
                  type="button"
                  onClick={handleStartTrackingClick}
                  className="flex-1 py-3 bg-[#0B8F68] hover:bg-emerald-700 active:bg-emerald-800 text-white font-black text-xs sm:text-sm rounded-2xl shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Play className="w-4 h-4 fill-white" />
                  <span>Start Tracking Route</span>
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={handleTogglePause}
                    className={`flex-1 py-2.5 font-black text-xs rounded-2xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      isPaused
                        ? 'bg-[#0B8F68] hover:bg-emerald-700 text-white shadow-xs'
                        : 'bg-slate-100 hover:bg-slate-200 text-[#163B32] border border-[#D6E9E1]'
                    }`}
                  >
                    {isPaused ? (
                      <>
                        <Play className="w-3.5 h-3.5 fill-current" />
                        <span>Resume</span>
                      </>
                    ) : (
                      <>
                        <Pause className="w-3.5 h-3.5 fill-current" />
                        <span>Pause</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={handleStopTracking}
                    className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white font-black text-xs rounded-2xl shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Square className="w-3.5 h-3.5 fill-white" />
                    <span>Stop &amp; Save</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* 3. Filter Segment: [ All | By Area | By Customer ] */}
        <div className="bg-slate-100 rounded-2xl p-1.5 border border-[#D6E9E1] shadow-xs flex items-center gap-1">
          <button
            type="button"
            onClick={() => setFilterMode('all')}
            className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all text-center cursor-pointer ${
              filterMode === 'all'
                ? 'bg-white text-slate-900 font-black shadow-xs'
                : 'text-[#55756D] hover:text-[#163B32]'
            }`}
          >
            All Route
          </button>
          <button
            type="button"
            onClick={() => setFilterMode('area')}
            className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all text-center cursor-pointer ${
              filterMode === 'area'
                ? 'bg-white text-slate-900 font-black shadow-xs'
                : 'text-[#55756D] hover:text-[#163B32]'
            }`}
          >
            By Area
          </button>
          <button
            type="button"
            onClick={() => setFilterMode('customer')}
            className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all text-center cursor-pointer ${
              filterMode === 'customer'
                ? 'bg-white text-slate-900 font-black shadow-xs'
                : 'text-[#55756D] hover:text-[#163B32]'
            }`}
          >
            By Customer
          </button>
        </div>

        {/* Area Sub-Selector */}
        {filterMode === 'area' && (
          <div className="glass-card rounded-2xl p-3 border border-[#D6E9E1] shadow-xs space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#55756D] block">
              Select Delivery Area / Sector
            </span>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setSelectedArea('All')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  selectedArea === 'All'
                    ? 'border-[#0B8F68] bg-[#0B8F68] text-white font-black shadow-xs'
                    : 'border-[#D6E9E1] bg-white text-[#55756D] hover:text-[#163B32]'
                }`}
              >
                All Areas
              </button>
              {availableAreas.length > 0 ? (
                availableAreas.map((areaName) => (
                  <button
                    key={areaName}
                    type="button"
                    onClick={() => setSelectedArea(areaName)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      selectedArea === areaName
                        ? 'border-[#0B8F68] bg-[#0B8F68] text-white font-black shadow-xs'
                        : 'border-[#D6E9E1] bg-white text-[#55756D] hover:text-[#163B32]'
                    }`}
                  >
                    {areaName}
                  </button>
                ))
              ) : (
                <span className="text-[11px] text-[#55756D] italic py-1">
                  No custom areas yet. Add areas in customer profiles.
                </span>
              )}
            </div>
          </div>
        )}

        {/* Customer Sub-Selector */}
        {filterMode === 'customer' && (
          <div className="glass-card rounded-2xl p-3 border border-[#D6E9E1] shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#55756D] block">
                Target Customer Destination
              </span>
              {selectedCustomer && (
                <button
                  type="button"
                  onClick={() => setSelectedCustomerId('')}
                  className="text-[10px] text-[#0B8F68] font-bold hover:underline cursor-pointer"
                >
                  Change
                </button>
              )}
            </div>

            {!selectedCustomer ? (
              <div className="space-y-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={customerSearch}
                    onChange={(e) => setCustomerSearch(e.target.value)}
                    placeholder="Search customer by name, area, phone..."
                    className="w-full pl-8.5 pr-3 py-2 text-xs font-semibold text-slate-900 bg-white border border-slate-300 rounded-xl outline-none focus:border-emerald-600"
                  />
                </div>

                <div className="max-h-48 overflow-y-auto divide-y divide-[#D6E9E1] border border-[#D6E9E1] rounded-xl bg-white">
                  {filteredCustomers.length > 0 ? (
                    filteredCustomers.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setSelectedCustomerId(c.id)}
                        className="w-full p-2.5 text-left flex items-center justify-between hover:bg-slate-50 transition-colors cursor-pointer text-slate-800"
                      >
                        <div>
                          <p className="text-xs font-bold text-[#163B32]">{c.name}</p>
                          <p className="text-[10px] text-[#55756D]">
                            {c.area ? `Area: ${c.area}` : c.address || c.phone}
                          </p>
                        </div>
                        {c.latitude != null && c.longitude != null ? (
                          <span className="text-[10px] font-bold text-[#0B8F68] bg-[#E1F3EA] px-2 py-0.5 rounded-md flex items-center gap-1 border border-[#D6E9E1]">
                            <MapPin className="w-2.5 h-2.5" />
                            GPS Saved
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md">
                            No GPS
                          </span>
                        )}
                      </button>
                    ))
                  ) : (
                    <p className="p-3 text-xs text-[#55756D] text-center">No customers found.</p>
                  )}
                </div>
              </div>
            ) : (
              <div className="p-3 bg-slate-50 border border-[#D6E9E1] rounded-xl space-y-2 text-[#163B32]">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-xs font-extrabold text-[#163B32]">{selectedCustomer.name}</h3>
                    <p className="text-[10px] text-[#55756D]">{selectedCustomer.phone}</p>
                    {selectedCustomer.address && (
                      <p className="text-[10px] text-[#55756D] mt-0.5">
                        📍 {selectedCustomer.address}
                      </p>
                    )}
                  </div>
                  {selectedCustomer.latitude != null && selectedCustomer.longitude != null && (
                    <a
                      href={`https://www.google.com/maps/dir/?api=1&destination=${selectedCustomer.latitude},${selectedCustomer.longitude}`}
                      target="_blank"
                      rel="noreferrer"
                      className="px-2 py-1 bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-[10px] font-bold rounded-lg flex items-center gap-1 shadow-xs hover:brightness-110 transition-all"
                    >
                      <span>Navigate</span>
                      <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  )}
                </div>

                {selectedCustomer.latitude == null || selectedCustomer.longitude == null ? (
                  <div className="pt-1 text-[11px] text-amber-700 font-medium">
                    ⚠️ This customer does not have saved GPS coordinates yet. Edit customer details to add location coordinates.
                  </div>
                ) : (
                  <div className="pt-1 border-t border-[#D6E9E1] flex items-center justify-between text-xs font-bold text-[#163B32]">
                    <span className="text-[#55756D]">Distance from current location:</span>
                    <span className="text-[#0B8F68] font-mono">{displayedDistanceKm.toFixed(2)} km</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* 4. Estimated Fuel Consumption & Cost Card (WARNING 8) */}
        <div className="glass-card rounded-3xl p-4 border border-[#D6E9E1] shadow-xs space-y-3 text-[#163B32]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-[#E1F3EA] text-[#0B8F68] border border-[#D6E9E1] flex items-center justify-center">
                <Fuel className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-black text-[#163B32] tracking-tight">
                  Estimated Fuel Usage
                </h3>
                <p className="text-[10px] text-[#55756D]">
                  {fuelEstimate.fuelType.toUpperCase()} · Based on your vehicle rate
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onOpenSettings}
              className="text-[11px] text-[#0B8F68] font-bold hover:underline flex items-center gap-1 cursor-pointer"
            >
              <SettingsIcon className="w-3 h-3" />
              <span>Fuel Settings</span>
            </button>
          </div>

          {fuelEstimate.estimatedLiters !== null ? (
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="p-3 bg-slate-50 rounded-2xl border border-[#D6E9E1]">
                <span className="text-[10px] font-bold text-[#55756D] uppercase tracking-wider block">
                  Fuel Consumed
                </span>
                <div className="flex items-baseline gap-1 mt-0.5">
                  <span className="text-xl font-black font-mono text-[#163B32]">
                    {fuelEstimate.estimatedLiters.toFixed(2)}
                  </span>
                  <span className="text-xs font-bold text-[#55756D]">Liters</span>
                </div>
                <span className="text-[9px] text-[#7A8C84] block mt-0.5">
                  (Estimated @ {fuelEstimate.fuelRateKmPerLiter} km/L)
                </span>
              </div>

              <div className="p-3 bg-[#E1F3EA] rounded-2xl border border-[#D6E9E1]">
                <span className="text-[10px] font-bold text-[#0B8F68] uppercase tracking-wider block">
                  Estimated Travel Cost
                </span>
                <div className="flex items-baseline gap-1 mt-0.5">
                  <span className="text-xl font-black font-mono text-[#0B8F68]">
                    {businessSettings.currencySymbol || 'Rs.'}{' '}
                    {fuelEstimate.estimatedCost?.toLocaleString() ?? '—'}
                  </span>
                </div>
                <span className="text-[9px] text-[#0B8F68]/80 block mt-0.5">
                  (Estimated cost)
                </span>
              </div>
            </div>
          ) : (
            <div className="p-3 bg-slate-50 rounded-2xl border border-[#D6E9E1] text-xs text-[#55756D] space-y-2">
              <p className="text-[11px]">
                Vehicle fuel rate not set yet. Set your vehicle km/L and fuel price per liter in Settings to see automatic fuel cost calculations.
              </p>
              <button
                type="button"
                onClick={onOpenSettings}
                className="px-3 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold text-xs rounded-xl shadow-xs hover:brightness-110 transition-all flex items-center gap-1 cursor-pointer"
              >
                <span>Configure Vehicle &amp; Fuel Rate</span>
                <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          )}

          <p className="text-[10px] text-[#55756D]/80 italic px-1">
            Note: Figures are estimated approximations based on average fuel consumption and road conditions.
          </p>
        </div>

        {/* 5. Recent Delivery Sessions History */}
        {sessions.length > 0 && (
          <div className="glass-card rounded-3xl p-4 border border-[#D6E9E1] shadow-xs space-y-3 text-[#163B32]">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black text-[#163B32] tracking-tight">
                Recent Saved Route Trips
              </h3>
              <span className="text-[10px] font-bold text-[#55756D]">
                {sessions.length} recorded
              </span>
            </div>

            <div className="divide-y divide-[#D6E9E1]">
              {sessions.slice(0, 5).map((s) => (
                <div key={s.id} className="py-2.5 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-[#163B32] block">
                      {new Date(s.startTime).toLocaleDateString('en-US', {
                        day: '2-digit',
                        month: 'short',
                      })}{' '}
                      · {new Date(s.startTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <span className="text-[10px] text-[#55756D]">
                      {s.area ? `Area: ${s.area} · ` : ''}
                      {s.pathPoints.length} GPS points
                    </span>
                  </div>

                  <div className="text-right">
                    <span className="font-mono font-bold text-[#0B8F68] block">
                      {s.totalKm.toFixed(2)} km
                    </span>
                    {s.fuelCost != null && (
                      <span className="text-[10px] text-[#55756D] font-medium">
                        ≈ {businessSettings.currencySymbol || 'Rs.'} {s.fuelCost}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Permission Explanation Modal (WARNING 5) */}
      {showPermissionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-sm w-full p-5 shadow-2xl border border-slate-200 text-center space-y-4 text-slate-900">
            <div className="w-14 h-14 rounded-2xl bg-[#E1F3EA] text-[#0B8F68] border border-[#D6E9E1] mx-auto flex items-center justify-center">
              <Navigation className="w-7 h-7 fill-[#0B8F68]" />
            </div>

            <div>
              <h3 className="text-base font-extrabold text-[#163B32]">
                Enable Delivery Route Tracker
              </h3>
              <p className="text-xs text-[#55756D] mt-1 leading-relaxed">
                Tracker needs your GPS location to measure delivery distance and calculate estimated fuel consumption while on your route.
              </p>
              <p className="text-[10px] text-slate-600 mt-2 bg-slate-50 p-2 rounded-xl border border-slate-200">
                🔒 Privacy: Location data remains strictly local to your device and is only recorded while tracking is active.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => setShowPermissionModal(false)}
                className="py-2.5 px-3 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmStartTracking}
                className="py-2.5 px-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-black text-xs rounded-xl shadow-md hover:brightness-110 transition-all cursor-pointer"
              >
                Allow &amp; Start
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
