import { success } from "@/lib/response";

export async function GET() {
  return success({ status: "healthy" }, "backend running");
}
