import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { couponDiscount } from "@/lib/pricing";
export async function POST(req: NextRequest) {
  const { code, subtotal } = await req.json().catch(() => ({}));
  const c = await prisma.coupon.findUnique({ where: { code: String(code || "").toUpperCase() } });
  if (!c) return NextResponse.json({ error: "That code isn’t valid." }, { status: 404 });
  if (Number(subtotal) < c.minOrder) return NextResponse.json({ error: `Minimum order ₹${c.minOrder / 100} needed.` }, { status: 400 });
  const d = couponDiscount(Number(subtotal), c);
  return d ? NextResponse.json({ code: c.code, discount: d }) : NextResponse.json({ error: "Code not applicable." }, { status: 400 });
}
