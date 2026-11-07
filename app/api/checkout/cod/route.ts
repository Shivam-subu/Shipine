import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { computeTotals } from "@/lib/pricing";

const Body = z.object({
  idempotencyKey: z.string().min(8).max(80),
  email: z.string().email(), phone: z.string().regex(/^[6-9]\d{9}$/),
  name: z.string().min(2).max(80), line1: z.string().min(5).max(200),
  city: z.string().min(2), state: z.string().min(2), pincode: z.string().regex(/^\d{6}$/),
  couponCode: z.string().max(40).optional(),
  items: z.array(z.object({ variantId: z.string(), quantity: z.number().int().min(1).max(10) })).min(1).max(20),
});
class StockError extends Error {}

export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid details", issues: parsed.error.flatten() }, { status: 400 });
  const b = parsed.data;

  const existing = await prisma.order.findUnique({ where: { idempotencyKey: b.idempotencyKey } });
  if (existing) return NextResponse.json({ orderNumber: existing.number, duplicate: true });

  try {
    const order = await prisma.$transaction(async (tx) => {
      const ids = [...new Set(b.items.map((i) => i.variantId))];
      const variants = await tx.variant.findMany({ where: { id: { in: ids } }, include: { product: true } });
      if (variants.length !== ids.length) throw new StockError("Item not found");
      const lines = b.items.map((i) => {
        const v = variants.find((x) => x.id === i.variantId)!;
        if (!v.product.published || v.product.archivedAt) throw new StockError(`${v.product.name} is unavailable`);
        return { v, quantity: i.quantity, unitPrice: v.price }; // price from DB only
      });
      // Atomic conditional decrement prevents overselling under concurrency.
      for (const l of lines) {
        const r = await tx.variant.updateMany({
          where: { id: l.v.id, stock: { gte: l.quantity } }, data: { stock: { decrement: l.quantity } } });
        if (r.count === 0) throw new StockError(`${l.v.product.name} is out of stock`);
      }
      const coupon = b.couponCode ? await tx.coupon.findUnique({ where: { code: b.couponCode.toUpperCase() } }) : null;
      const rows = await tx.setting.findMany({ where: { key: { in: ["shippingFee", "freeShippingAt", "codFee"] } } });
      const s = Object.fromEntries(rows.map((r) => [r.key, Number(r.value)]));
      const t = computeTotals(lines, coupon,
        { shippingFee: s.shippingFee ?? 9900, freeShippingAt: s.freeShippingAt ?? 149900, codFee: s.codFee ?? 0 }, true);
      if (coupon && t.discount > 0) await tx.coupon.update({ where: { id: coupon.id }, data: { usedCount: { increment: 1 } } });
      const o = await tx.order.create({ data: {
        number: "PIN-" + Date.now().toString(36).toUpperCase(), idempotencyKey: b.idempotencyKey,
        email: b.email, phone: b.phone, shipName: b.name, shipLine1: b.line1, shipCity: b.city,
        shipState: b.state, shipPincode: b.pincode, paymentMethod: "COD", paymentStatus: "UNPAID",
        status: "CONFIRMED", couponCode: t.discount > 0 ? coupon!.code : null,
        subtotal: t.subtotal, discount: t.discount, shipping: t.shipping, codFee: t.codFee, total: t.total,
        items: { create: lines.map((l) => ({ variantId: l.v.id, name: l.v.product.name, sku: l.v.sku, unitPrice: l.unitPrice, quantity: l.quantity })) },
      } });
      await tx.stockMovement.createMany({
        data: lines.map((l) => ({ variantId: l.v.id, delta: -l.quantity, reason: "ORDER", orderId: o.id })) });
      return o;
    });
    return NextResponse.json({ orderNumber: order.number });
  } catch (e) {
    if (e instanceof StockError) return NextResponse.json({ error: e.message }, { status: 409 });
    console.error("cod checkout failed"); // no customer data in logs
    return NextResponse.json({ error: "Could not place order" }, { status: 500 });
  }
}
