import { handleArkeselUssd } from "@/lib/ussd/arkesel";
export const runtime="nodejs";
export async function POST(request:Request){return handleArkeselUssd(request);}
