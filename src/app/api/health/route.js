import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(
    { ok: true, service: "life-command-center" },
    { status: 200 }
  );
}