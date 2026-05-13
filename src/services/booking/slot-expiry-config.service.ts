import { prisma } from "@/lib/db";
import {
  SLOT_EXPIRY_GRACE_MINUTES_KEY,
  SLOT_EXPIRY_MODE_KEY,
  resolveSlotExpiryConfigFromSettingsMap,
  type SlotExpiryConfig,
} from "@/lib/slot-time";

type SlotExpiryConfigReader = {
  appSetting?: typeof prisma.appSetting;
};

export async function resolveSlotExpiryConfig(
  reader: SlotExpiryConfigReader = prisma
): Promise<SlotExpiryConfig> {
  const appSettingDelegate = reader?.appSetting;
  if (!appSettingDelegate) {
    return resolveSlotExpiryConfigFromSettingsMap();
  }

  try {
    const settings = await appSettingDelegate.findMany({
      where: {
        key: {
          in: [SLOT_EXPIRY_MODE_KEY, SLOT_EXPIRY_GRACE_MINUTES_KEY],
        },
      },
      select: {
        key: true,
        value: true,
      },
    });

    const map: Record<string, string> = {};
    for (const setting of settings) {
      map[setting.key] = setting.value;
    }

    return resolveSlotExpiryConfigFromSettingsMap(map);
  } catch {
    return resolveSlotExpiryConfigFromSettingsMap();
  }
}
