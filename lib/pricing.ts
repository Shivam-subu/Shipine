import type { Coupon } from "@prisma/client";
export type Line = { unitPrice: number; quantity: number };
export type Rules = { shippingFee: number; freeShippingAt: number; codFee: number };

export function couponDiscount(sub: number, c: Coupon | null, now = new Date()) {
  if (!c || !c.active) return 0;
  if (c.startsAt && c.startsAt > now) return 0;
  if (c.expiresAt && c.expiresAt < now) return 0;
  if (c.maxUses != null && c.usedCount >= c.maxUses) return 0;
  if (sub < c.minOrder) return 0;
  const d = c.percentOff ? Math.floor((sub * c.percentOff) / 100) : (c.amountOff ?? 0);
  return Math.min(d, sub);
}
export function computeTotals(lines: Line[], c: Coupon | null, r: Rules, cod: boolean) {
  const subtotal = lines.reduce((n, l) => n + l.unitPrice * l.quantity, 0);
  const discount = couponDiscount(subtotal, c);
  const shipping = subtotal - discount >= r.freeShippingAt ? 0 : r.shippingFee;
  const codFee = cod ? r.codFee : 0;
  return { subtotal, discount, shipping, codFee, total: subtotal - discount + shipping + codFee };
}
