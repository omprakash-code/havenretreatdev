type RazorpayOrderCreateInput = {
  amount: number;
  currency: string;
  receipt: string;
  payment_capture: boolean;
};

type RazorpayOrderCreateResponse = {
  id: string;
  amount: number;
  currency: string;
  receipt: string;
  status?: string;
};

export class RazorpayServerError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function getRazorpayCredentials() {
  const keyId = process.env.RAZORPAY_KEY_ID?.trim();
  const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim();

  if (!keyId || !keySecret) {
    throw new RazorpayServerError(
      500,
      "Payment gateway is not configured."
    );
  }

  return { keyId, keySecret };
}

export async function createRazorpayOrder(
  input: RazorpayOrderCreateInput
): Promise<RazorpayOrderCreateResponse> {
  const { keyId, keySecret } = getRazorpayCredentials();
  const authToken = Buffer.from(`${keyId}:${keySecret}`).toString("base64");

  const res = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      Authorization: `Basic ${authToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
    cache: "no-store",
  });

  const json = (await res.json().catch(() => null)) as
    | Partial<RazorpayOrderCreateResponse> & { error?: { description?: string } }
    | null;

  if (!res.ok || !json?.id || typeof json.amount !== "number") {
    throw new RazorpayServerError(
      res.status || 502,
      json?.error?.description || "Failed to create Razorpay order."
    );
  }

  return {
    id: json.id,
    amount: json.amount,
    currency: json.currency ?? input.currency,
    receipt: json.receipt ?? input.receipt,
    status: json.status,
  };
}
