import { handleNativeArkesel } from "@/lib/ussd/native-arkesel";
import { handleArkeselUssd } from "@/lib/ussd/arkesel";
export const runtime="nodejs";
export async function POST(request:Request){return request.headers.get("content-type")?.includes("application/json") ? handleNativeArkesel(request) : handleArkeselUssd(request);}
