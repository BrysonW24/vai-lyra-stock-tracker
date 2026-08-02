'use client';

import { useEffect, useState } from 'react';
import { Cloud, CloudFog, CloudLightning, CloudRain, CloudSnow, MapPin, Sun, type LucideIcon } from 'lucide-react';

interface LocalContext {
  city?: string;
  tempCurrent?: number;
  unit?: 'C' | 'F';
  code?: number;
}

// WMO weather codes (Open-Meteo) -> a representative icon.
function weatherIcon(code?: number): LucideIcon {
  if (code == null) return Cloud;
  if (code === 0) return Sun;
  if (code <= 3) return Cloud;
  if (code <= 48) return CloudFog;
  if (code <= 67) return CloudRain;
  if (code <= 77) return CloudSnow;
  if (code <= 82) return CloudRain;
  if (code >= 95) return CloudLightning;
  return Cloud;
}

// "Australia/Sydney" -> "Sydney"; "America/Argentina/Buenos_Aires" -> "Buenos Aires".
function cityFromTimezone(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    return tz.split('/').pop()?.replaceAll('_', ' ') ?? '';
  } catch {
    return '';
  }
}

/**
 * Local context bar - date + weather + city above the boards so the space carries value.
 * The city comes from the device timezone (instant, no network, no permission - so it
 * always shows). Weather is a best-effort Open-Meteo lookup (geocode the city -> current
 * conditions; both keyless and CORS-friendly). If weather fails, date + city still show.
 */
export function LocalContextBar() {
  const [now, setNow] = useState<Date | null>(null);
  const [ctx, setCtx] = useState<LocalContext>({});

  useEffect(() => {
    setNow(new Date());
    const tick = window.setInterval(() => setNow(new Date()), 60_000);
    let cancelled = false;

    const city = cityFromTimezone();
    if (city) setCtx({ city });

    (async () => {
      try {
        if (!city) return;
        const geo = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1`).then((r) => (r.ok ? r.json() : null));
        const place = geo?.results?.[0];
        if (!place || cancelled) return;
        const fahrenheit = place.country_code === 'US';
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}&current=temperature_2m,weather_code${fahrenheit ? '&temperature_unit=fahrenheit' : ''}`;
        const w = await fetch(url).then((r) => (r.ok ? r.json() : null));
        if (w?.current && !cancelled) {
          setCtx({ city: place.name || city, tempCurrent: Math.round(w.current.temperature_2m), unit: fahrenheit ? 'F' : 'C', code: w.current.weather_code });
        }
      } catch {
        /* date + city still show */
      }
    })();

    return () => {
      cancelled = true;
      window.clearInterval(tick);
    };
  }, []);

  // Reserve height pre-mount so the row never jumps (and SSR/first paint match).
  if (!now) return <div className="h-4" aria-hidden />;

  const dateStr = now.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
  const WeatherIcon = weatherIcon(ctx.code);

  return (
    <div className="flex min-w-0 items-center gap-2 font-mono text-[10px] text-ink-3">
      <span className="shrink-0 text-ink-2">{dateStr}</span>
      {ctx.tempCurrent != null && (
        <span className="inline-flex shrink-0 items-center gap-1">
          <span className="text-line-hair">·</span>
          <WeatherIcon size={12} className="text-blue-info" />
          {ctx.tempCurrent}°{ctx.unit}
        </span>
      )}
      {ctx.city && (
        <span className="inline-flex min-w-0 items-center gap-1" title={ctx.city}>
          <span className="text-line-hair">·</span>
          <MapPin size={11} className="shrink-0 text-positive" />
          <span className="truncate">{ctx.city}</span>
        </span>
      )}
    </div>
  );
}
