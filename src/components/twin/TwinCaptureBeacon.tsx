'use client';

import { useEffect } from 'react';
import { captureInteraction, type InteractionEvent } from '@/lib/twin/capture';

/**
 * Drop-in attention beacon. Renders nothing; fires one deduped capture on mount. Safe to place on
 * any surface (ticker/theme detail, etc.) - the server enforces the opt-in consent gate, so this is
 * inert until the user turns twin capture on.
 */
export function TwinCaptureBeacon(props: InteractionEvent) {
  useEffect(() => {
    captureInteraction(props);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.eventType, props.entityType, props.entityId]);
  return null;
}
