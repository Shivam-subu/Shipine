import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
export async function POST(req: NextRequest) {
  const p = z.object({ email: z.string().email() }).safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  const email = p.data.email.toLowerCase();
  const had = await prisma.subscriber.findUnique({ where: { email } });
  if (!had) await prisma.subscriber.create({ data: { email } });
  return NextResponse.json({ ok: true, duplicate: !!had });
}
