import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthenticatedAdminIdFromCookies } from "@/services/auth/adminAuth.server";
import {
  isKnownAppSettingKey,
  mergeWithKnownAppSettings,
  normalizeAppSettingValue,
  sortAppSettings,
  validateAppSetting,
} from "@/lib/app-settings";

type SettingsPayload = {
  settings?: Array<{
    key: string;
    value: string;
  }>;
};

async function getAuthenticatedAdminId() {
  return getAuthenticatedAdminIdFromCookies();
}

export async function GET() {
  try {
    const adminId = await getAuthenticatedAdminId();
    if (!adminId) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    const rows = await prisma.appSetting.findMany({
      orderBy: { key: "asc" },
    });
    const settings = sortAppSettings(
      mergeWithKnownAppSettings(
        rows.map((row) => ({
          key: row.key,
          value: row.value,
        }))
      )
    );

    return NextResponse.json({
      success: true,
      data: settings,
    });
  } catch (error) {
    console.error("[GET_ADMIN_SETTINGS]", error);
    return NextResponse.json(
      { success: false, message: "Failed to load settings." },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request) {
  try {
    const adminId = await getAuthenticatedAdminId();
    if (!adminId) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = (await req.json()) as SettingsPayload;
    const updates = Array.isArray(body.settings) ? body.settings : [];

    if (updates.length === 0) {
      return NextResponse.json(
        { success: false, message: "No settings provided." },
        { status: 400 }
      );
    }

    const normalized = updates.map((item) => ({
      key: String(item.key ?? "").trim(),
      value: normalizeAppSettingValue(
        String(item.key ?? "").trim(),
        String(item.value ?? "")
      ),
    }));

    const hasInvalid = normalized.some((item) => !item.key);
    if (hasInvalid) {
      return NextResponse.json(
        { success: false, message: "Invalid setting key." },
        { status: 400 }
      );
    }

    const existingRows = await prisma.appSetting.findMany({
      select: { key: true },
    });
    const existingKeys = new Set(existingRows.map((item) => item.key));

    const unknownNewKey = normalized.find(
      (item) => !isKnownAppSettingKey(item.key) && !existingKeys.has(item.key)
    );
    if (unknownNewKey) {
      return NextResponse.json(
        {
          success: false,
          message: `Unknown setting key: ${unknownNewKey.key}`,
        },
        { status: 400 }
      );
    }

    const invalidSetting = normalized
      .map((item) => ({
        key: item.key,
        message: validateAppSetting(item.key, item.value),
      }))
      .find((item) => Boolean(item.message));

    if (invalidSetting?.message) {
      return NextResponse.json(
        {
          success: false,
          message: invalidSetting.message,
        },
        { status: 400 }
      );
    }

    await prisma.$transaction(
      normalized.map((item) =>
        prisma.appSetting.upsert({
          where: { key: item.key },
          update: { value: item.value },
          create: {
            key: item.key,
            value: item.value,
          },
        })
      )
    );

    const rows = await prisma.appSetting.findMany({
      orderBy: { key: "asc" },
    });
    const settings = sortAppSettings(
      mergeWithKnownAppSettings(
        rows.map((row) => ({
          key: row.key,
          value: row.value,
        }))
      )
    );

    return NextResponse.json({
      success: true,
      data: settings,
    });
  } catch (error) {
    console.error("[PATCH_ADMIN_SETTINGS]", error);
    return NextResponse.json(
      { success: false, message: "Failed to update settings." },
      { status: 500 }
    );
  }
}
