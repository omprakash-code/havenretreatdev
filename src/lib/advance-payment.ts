import {
  ADVANCE_PAYMENT_AMOUNT_KEY,
  parseAdvancePaymentAmount,
} from "@/lib/app-settings";

type AppSettingReader = {
  appSetting: {
    findUnique(args: {
      where: { key: string };
      select?: { value: true };
    }): Promise<{ value: string } | null>;
  };
};

export class AdvancePaymentConfigError extends Error {
  constructor(message = "Advance payment configuration is missing or invalid.") {
    super(message);
    this.name = "AdvancePaymentConfigError";
  }
}

export async function getRequiredAdvancePaymentAmount(db: AppSettingReader) {
  const setting = await db.appSetting.findUnique({
    where: { key: ADVANCE_PAYMENT_AMOUNT_KEY },
    select: { value: true },
  });

  const amount = parseAdvancePaymentAmount(setting?.value);
  if (amount === null) {
    throw new AdvancePaymentConfigError();
  }

  return amount;
}
