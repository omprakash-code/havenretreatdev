"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type UseLockCountdownInput = {
  lockExpiresAt?: string | Date | null;
  warningThresholdSec?: number;
  onExpire?: () => void;
};

function toExpiryMs(lockExpiresAt?: string | Date | null) {
  if (!lockExpiresAt) return null;
  const date =
    typeof lockExpiresAt === "string" ? new Date(lockExpiresAt) : lockExpiresAt;
  const expiryMs = date.getTime();
  return Number.isFinite(expiryMs) ? expiryMs : null;
}

export function formatLockCountdown(totalSeconds: number | null) {
  if (totalSeconds == null) return null;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function useLockCountdown({
  lockExpiresAt,
  warningThresholdSec = 60,
  onExpire,
}: UseLockCountdownInput) {
  const expiryMs = useMemo(() => toExpiryMs(lockExpiresAt), [lockExpiresAt]);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const remainingSec = useMemo(() => {
    if (expiryMs == null) return null;
    return Math.max(Math.ceil((expiryMs - nowMs) / 1000), 0);
  }, [expiryMs, nowMs]);
  const expireTriggeredRef = useRef(false);
  const onExpireRef = useRef(onExpire);

  useEffect(() => {
    onExpireRef.current = onExpire;
  }, [onExpire]);

  useEffect(() => {
    expireTriggeredRef.current = false;

    if (expiryMs == null) return;

    const intervalId = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [expiryMs]);

  useEffect(() => {
    if (remainingSec == null || remainingSec > 0 || expireTriggeredRef.current) {
      return;
    }
    expireTriggeredRef.current = true;
    onExpireRef.current?.();
  }, [remainingSec]);

  const isExpiringSoon =
    remainingSec !== null &&
    remainingSec > 0 &&
    remainingSec <= warningThresholdSec;

  return {
    remainingSec,
    isExpiringSoon,
    formatted: formatLockCountdown(remainingSec),
  };
}
