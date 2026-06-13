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

/**
 * Local context bar - fills the top strip with the date, current weather and city so the
 * space above the boards carries value instead of sitting blank. Date is instant; weather
 * + location are a best-effort IP lookup (ipwho.is) + Open-Meteo, both keyless and
 * CORS-friendly. If either call fails it degrades silently to just the date.
 */
export function LocalContextBar() {
  const [now, setNow] = useState<Date | null>(null);
  const [ctx, setCtx] = useState<LocalContext>({});

  useEffect(() => {
    setNow(new Date());
    const tick = window.setInterval(() => setNow(new Date()), 60_000);
    let cancelled = false;

    (async () => {
      try {
        const loc = await fetch('https://ipwho.is/').then((r) => (r.ok ? r.json() : null));
        if (!loc?.success || cancelled) return;
        const fahrenheit = loc.country_code === 'US';
        const next: LocalContext = { city: loc.city, unit: fahrenheit ? 'F' : 'C' };
        if (typeof loc.latitude === 'number' && typeof loc.longitude === 'number') {
          const url = `https://api.open-meteo.com/v1/forecast?latitude=${loc.latitude}&longitude=${loc.longitude}&current=temperature_2m,weather_code${fahrenheit ? '&temperature_unit=fahrenheit' : ''}`;
          const w = await fetch(url).then((r) => (r.ok ? r.json() : null));
          if (w?.current && !cancelled) {
            next.tempCurrent = Math.round(w.current.temperature_2m);
            next.code = w.current.weather_code;
          }
        }
        if (!cancelled) setCtx(next);
      } catch {
        /* date still shows */
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
    <div className="flex min-w-0 items-center gap-2 font-mono text-[10px] text-[#8190a0]">
      <span className="shrink-0 text-[#a8b5c2]">{dateStr}</span>
      {ctx.tempCurrent != null && (
        <span className="inline-flex shrink-0 items-center gap-1">
          <span className="text-[#3a4754]">·</span>
          <WeatherIcon size={12} className="text-[#7fb0ff]" />
          {ctx.tempCurrent}°{ctx.unit}
        </span>
      )}
      {ctx.city && (
        <span className="inline-flex min-w-0 items-center gap-1" title={ctx.city}>
          <span className="text-[#3a4754]">·</span>
          <MapPin size={11} className="shrink-0 text-[#43d18b]" />
          <span className="truncate">{ctx.city}</span>
        </span>
      )}
    </div>
  );
}
