import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const q = sp.get("q") ?? "";
  const cat = sp.get("category");
  const max = Number(sp.get("maxPrice") || 0) * 100;
  const inStock = sp.get("inStock") === "1";
  const size = Math.min(100, Number(sp.get("pageSize") || 12));
  const page = Math.max(1, Number(sp.get("page") || 1));
  const where = {
    published: true, archivedAt: null,
    ...(cat && { category: { slug: cat } }),
    ...(q && { OR: [
      { name: { contains: q, mode: "insensitive" as const } },
      { description: { contains: q, mode: "insensitive" as const } } ] }),
    variants: { some: { ...(max && { price: { lte: max } }), ...(inStock && { stock: { gt: 0 } }) } },
  };
  const [total, products] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * size, take: size,
      include: { variants: true, images: { orderBy: { position: "asc" }, take: 1 }, category: true } }),
  ]);
  return NextResponse.json({ total, page, products });
}
