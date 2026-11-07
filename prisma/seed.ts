// Sample data only. Names and prices are development placeholders.
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const cats = ["Necklaces", "Earrings", "Rings", "Bracelets", "Jewelry Sets", "Gifts"];
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
// [name, category, sku, price INR, compare-at INR (0 = none), stock, material]
const best = new Set(["PN-NK-001","PN-ER-001","PN-RG-002","PN-BR-001","PN-ST-001"]);
const fresh = new Set(["PN-NK-002","PN-NK-003","PN-ER-002","PN-RG-002","PN-BR-002","PN-ST-001","PN-GF-001"]);
const occ: Record<string,string[]> = { Necklaces:["Date Night","Office Wear"], Earrings:["Everyday Essentials","Party Edit"], Rings:["Everyday Essentials","Date Night"], Bracelets:["Everyday Essentials","Office Wear"], "Jewelry Sets":["Party Edit","Date Night"], Gifts:["Gifts Under ₹999"] };
const items: [string, string, string, number, number, number, string][] = [
  ["Solitaire Drop Pendant", "Necklaces", "PN-NK-001", 799, 999, 12, "Brass base, gold-tone finish"],
  ["Layered Link Necklace", "Necklaces", "PN-NK-002", 1299, 0, 8, "Stainless steel, gold-tone finish"],
  ["Tiny Pearl Choker", "Necklaces", "PN-NK-003", 899, 0, 0, "Faux pearl, brass clasp"],
  ["Everyday Huggie Hoops", "Earrings", "PN-ER-001", 499, 699, 25, "Stainless steel, gold-tone finish"],
  ["Crescent Stud Earrings", "Earrings", "PN-ER-002", 399, 0, 30, "Brass, gold-tone finish"],
  ["Chandelier Drops", "Earrings", "PN-ER-003", 999, 1299, 6, "Brass, crystal-look stones"],
  ["Twist Band Ring", "Rings", "PN-RG-001", 449, 0, 18, "Stainless steel, gold-tone finish"],
  ["Sparkle Stack Ring Set", "Rings", "PN-RG-002", 699, 899, 10, "Brass, cubic zirconia"],
  ["Slim Chain Bracelet", "Bracelets", "PN-BR-001", 599, 0, 20, "Stainless steel, gold-tone finish"],
  ["Open Cuff Bangle", "Bracelets", "PN-BR-002", 849, 0, 7, "Brass, gold-tone finish"],
  ["Pendant and Hoop Set", "Jewelry Sets", "PN-ST-001", 1199, 1499, 9, "Brass, gold-tone finish"],
  ["Gift Box: Studs and Pendant", "Gifts", "PN-GF-001", 949, 0, 15, "Mixed, see product details"],
];
async function main() {
  for (const c of cats)
    await prisma.category.upsert({ where: { slug: slug(c) }, update: {}, create: { slug: slug(c), name: c } });
  for (const [name, cat, sku, price, cmp, stock, material] of items) {
    const category = await prisma.category.findUniqueOrThrow({ where: { slug: slug(cat) } });
    await prisma.product.upsert({ where: { slug: slug(name) }, update: {}, create: {
      slug: slug(name), name, material, published: true, bestseller: best.has(sku), featured: fresh.has(sku), occasions: occ[cat], categoryId: category.id,
      description: `${name}. ${material}. Lightweight, skin-friendly and made for everyday wear.`,
      images: { create: [{ url: `/images/${slug(name)}.svg`, alt: name }] },
      variants: { create: [{ sku, price: price * 100, compareAtPrice: cmp ? cmp * 100 : null, stock }] },
    } });
  }
  const settings = { shippingFee: 9900, freeShippingAt: 149900, codFee: 0 };
  for (const [key, value] of Object.entries(settings))
    await prisma.setting.upsert({ where: { key }, update: {}, create: { key, value } });
  await prisma.coupon.upsert({ where: { code: "PINSHI10" }, update: {}, create: { code: "PINSHI10", percentOff: 10, minOrder: 99900 } });
  console.log("Seeded sample data. No admin user is created: see README.");
}
main().finally(() => prisma.$disconnect());
