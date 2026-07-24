import { PrismaService } from '../prisma/prisma.service';

// Single source of truth for "is this product actually available to sell":
// serialized (phone) products need at least one IN_STOCK IMEI/serial unit;
// quantity-based accessories need stockQty > 0. Every place that counts or
// lists "active" products (Products Page, POS, Category counts) calls these
// same two functions so the numbers can never drift apart from each other.
export async function computeAvailabilityMap(
  prisma: PrismaService,
  businessId: string,
  products: { id: string; isSerialized: boolean }[],
): Promise<Map<string, number>> {
  const serializedIds = products.filter((p) => p.isSerialized).map((p) => p.id);
  const availabilityMap = new Map<string, number>();
  if (serializedIds.length > 0) {
    const counts = await prisma.productUnit.groupBy({
      by: ['productId'],
      where: {
        businessId,
        productId: { in: serializedIds },
        status: 'IN_STOCK',
      },
      _count: { _all: true },
    });
    for (const c of counts) availabilityMap.set(c.productId, c._count._all);
  }
  return availabilityMap;
}

export function isInStock(
  p: { isSerialized: boolean; stockQty: number },
  availableUnits: number | undefined,
): boolean {
  return p.isSerialized ? (availableUnits ?? 0) > 0 : p.stockQty > 0;
}
