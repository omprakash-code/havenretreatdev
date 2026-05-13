import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthenticatedAdminIdFromCookies } from "@/services/auth/adminAuth.server";
import {
  HOME_COUPON_DRAWER_CONFIG_KEY,
  HOME_COUPON_STRIP_CONFIG_KEY,
  resolveHomeCouponWidgetSettingsFromRows,
  sanitizeHomeCouponWidgetSettings,
  serializeHomeCouponWidgetSettings,
} from "@/lib/coupon-widget-settings";

const COUPON_WIDGET_SETTING_KEYS = [
  HOME_COUPON_DRAWER_CONFIG_KEY,
  HOME_COUPON_STRIP_CONFIG_KEY,
] as const;

export async function GET() {
  try {
    const adminId = await getAuthenticatedAdminIdFromCookies();
    if (!adminId) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    const rows = await prisma.appSetting.findMany({
      where: {
        key: {
          in: [...COUPON_WIDGET_SETTING_KEYS],
        },
      },
      select: {
        key: true,
        value: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: resolveHomeCouponWidgetSettingsFromRows(rows),
    });
  } catch (error) {
    console.error("[GET_ADMIN_COUPON_WIDGET_SETTINGS]", error);
    return NextResponse.json(
      { success: false, message: "Failed to load coupon widget settings." },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request) {
  try {
    const adminId = await getAuthenticatedAdminIdFromCookies();
    if (!adminId) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = (await req.json()) as unknown;
    const safePayload = sanitizeHomeCouponWidgetSettings(body);
    const updates = serializeHomeCouponWidgetSettings(safePayload);

    await prisma.$transaction(
      updates.map((setting) =>
        prisma.appSetting.upsert({
          where: { key: setting.key },
          update: {
            value: setting.value,
          },
          create: {
            key: setting.key,
            value: setting.value,
          },
        })
      )
    );

    const rows = await prisma.appSetting.findMany({
      where: {
        key: {
          in: [...COUPON_WIDGET_SETTING_KEYS],
        },
      },
      select: {
        key: true,
        value: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: resolveHomeCouponWidgetSettingsFromRows(rows),
    });
  } catch (error) {
    console.error("[PATCH_ADMIN_COUPON_WIDGET_SETTINGS]", error);
    return NextResponse.json(
      { success: false, message: "Failed to update coupon widget settings." },
      { status: 500 }
    );
  }
}
