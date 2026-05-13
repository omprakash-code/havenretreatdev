import { Prisma } from "@prisma/client";
import { formatInTimeZone } from "date-fns-tz";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isValidPhone, normalizePhone } from "@/lib/phone";

type WaitlistPayload = {
  name?: string;
  phone?: string;
  email?: string;
  city?: string;
  locationPreference?: string;
  theatrePreference?: string;
  preferredDate?: string | null;
  preferredTime?: string | null;
  peopleCount?: number | string | null;
  occasion?: string | null;
  notes?: string | null;
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DUPLICATE_WINDOW_MS = 24 * 60 * 60 * 1000;

function isValidEmail(value: string) {
  return EMAIL_REGEX.test(value);
}

function parsePreferredDate(input: string | null | undefined) {
  if (!input) {
    return { value: null as Date | null, invalid: false };
  }
  const trimmed = input.trim();
  if (!trimmed) {
    return { value: null as Date | null, invalid: false };
  }

  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) {
    return { value: null as Date | null, invalid: true };
  }
  return { value: date, invalid: false };
}

function parsePeopleCount(input: number | string | null | undefined) {
  if (input === null || input === undefined || input === "") return null;
  const parsed = Number(input);
  if (!Number.isFinite(parsed)) return null;
  return Math.trunc(parsed);
}

function buildWaitlistReference(now: Date, counter: number) {
  const day = formatInTimeZone(now, "Asia/Kolkata", "yyyyMMdd");
  const incremental = String(counter).padStart(4, "0");
  return `DS-${day}-${incremental}`;
}

function getWaitlistReferencePrefix(now: Date) {
  const day = formatInTimeZone(now, "Asia/Kolkata", "yyyyMMdd");
  return `DS-${day}-`;
}

function isWaitlistReferenceUniqueConflict(error: unknown) {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false;
  if (error.code !== "P2002") return false;

  const target = error.meta?.target;
  if (Array.isArray(target)) {
    return target.some((value) => String(value).includes("reference"));
  }

  return typeof target === "string" && target.includes("reference");
}

async function getNextWaitlistCounter(now: Date) {
  const prefix = getWaitlistReferencePrefix(now);
  const latest = await prisma.waitlistEntry.findFirst({
    where: {
      reference: {
        startsWith: prefix,
      },
    },
    orderBy: {
      reference: "desc",
    },
    select: {
      reference: true,
    },
  });

  if (!latest?.reference) return 1;

  const currentCounter = Number(latest.reference.split("-").at(-1));
  if (!Number.isInteger(currentCounter) || currentCounter < 1) return 1;

  return currentCounter + 1;
}

async function createWithUniqueReference(
  data: Omit<Prisma.WaitlistEntryCreateInput, "reference">
) {
  const now = new Date();
  const maxRetries = 6;
  const nextCounter = await getNextWaitlistCounter(now);

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const reference = buildWaitlistReference(now, nextCounter + attempt);
    try {
      return await prisma.waitlistEntry.create({
        data: {
          ...data,
          reference,
        },
      });
    } catch (error) {
      if (isWaitlistReferenceUniqueConflict(error)) {
        continue;
      }
      throw error;
    }
  }

  throw new Error("Failed to generate unique waitlist reference.");
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as WaitlistPayload;

    const name = String(body.name ?? "").trim();
    const phone = normalizePhone(String(body.phone ?? ""));
    const email = String(body.email ?? "").trim();
    const city = String(body.city ?? "").trim();
    const locationPreference = String(body.locationPreference ?? "").trim();
    const theatrePreference = String(body.theatrePreference ?? "").trim();
    const preferredDateParsed = parsePreferredDate(body.preferredDate);
    const preferredDate = preferredDateParsed.value;
    const preferredTime = String(body.preferredTime ?? "").trim();
    const peopleCount = parsePeopleCount(body.peopleCount);
    const occasion = String(body.occasion ?? "").trim();
    const notes = String(body.notes ?? "").trim();

    if (name.length < 2) {
      return NextResponse.json(
        { success: false, message: "Please enter a valid name." },
        { status: 400 }
      );
    }

    if (!isValidPhone(phone)) {
      return NextResponse.json(
        { success: false, message: "Please enter a valid 10-digit phone number." },
        { status: 400 }
      );
    }

    if (email && !isValidEmail(email)) {
      return NextResponse.json(
        { success: false, message: "Please enter a valid email address." },
        { status: 400 }
      );
    }

    if (preferredDateParsed.invalid) {
      return NextResponse.json(
        { success: false, message: "Please select a valid preferred date." },
        { status: 400 }
      );
    }

    if (!locationPreference) {
      return NextResponse.json(
        { success: false, message: "Please select your preferred location." },
        { status: 400 }
      );
    }

    if (peopleCount === null || peopleCount < 1 || peopleCount > 50) {
      return NextResponse.json(
        { success: false, message: "Number of people should be between 1 and 50." },
        { status: 400 }
      );
    }

    const duplicate = await prisma.waitlistEntry.findFirst({
      where: {
        phone,
        status: { in: ["NEW", "CONTACTED"] },
        createdAt: {
          gte: new Date(Date.now() - DUPLICATE_WINDOW_MS),
        },
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        reference: true,
        createdAt: true,
      },
    });

    if (duplicate) {
      return NextResponse.json(
        {
          success: false,
          code: "DUPLICATE_WAITLIST",
          message:
            "You already joined the waitlist recently. Our team will contact you soon.",
          data: {
            id: duplicate.id,
            reference: duplicate.reference,
            createdAt: duplicate.createdAt.toISOString(),
          },
        },
        { status: 409 }
      );
    }

    const created = await createWithUniqueReference({
      name,
      phone,
      email: email || null,
      city: city || null,
      locationPreference,
      theatrePreference: theatrePreference || null,
      preferredDate,
      preferredTime: preferredTime || null,
      peopleCount,
      occasion: occasion || null,
      notes: notes || null,
    });

    return NextResponse.json(
      {
        success: true,
        message: "You have been added to the waiting list.",
        data: {
          id: created.id,
          reference: created.reference,
          status: created.status,
          createdAt: created.createdAt.toISOString(),
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/waitlist error:", error);
    return NextResponse.json(
      { success: false, message: "Failed to join the waiting list." },
      { status: 500 }
    );
  }
}
