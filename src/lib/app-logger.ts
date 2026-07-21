type LogPayload = Record<string, unknown>;

function writeLog(
  level: "debug" | "info" | "warn" | "error",
  event: string,
  payload?: LogPayload
) {
  if (payload && Object.keys(payload).length > 0) {
    console[level](event, payload);
    return;
  }

  console[level](event);
}

export function isEnvFlagEnabled(name: string) {
  return String(process.env[name] ?? "").toLowerCase() === "true";
}

export const appLogger = {
  debug(event: string, payload?: LogPayload) {
    if (isEnvFlagEnabled("APP_DEBUG")) {
      writeLog("debug", event, payload);
    }
  },
  performance(event: string, payload?: LogPayload) {
    if (isEnvFlagEnabled("BOOKING_PERFORMANCE_DEBUG")) {
      writeLog("debug", event, payload);
    }
  },
  info(event: string, payload?: LogPayload) {
    writeLog("info", event, payload);
  },
  warn(event: string, payload?: LogPayload) {
    writeLog("warn", event, payload);
  },
  error(event: string, payload?: LogPayload) {
    writeLog("error", event, payload);
  },
};
