'use client';

import { useEffect, useState, Fragment } from 'react';
import { getSales, Sale } from '@/lib/sales';

export default function SalesHistoryPage() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    getSales()
      .then(setSales)
      .catch(() => setError('Could not load sales.'))
      .finally(() => setLoading(false));
  }, []);

  function formatDate(iso: string): string {
    return new Date(iso).toLocaleString();
  }

  function toggleExpand(id: string) {
    setExpandedId((prev) => (prev === id ? null : id));
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <h1 className="mb-6 text-2xl font-bold text-gray-900">Sales History</h1>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        {loading ? (
          <p className="p-4 text-gray-500">Loading...</p>
        ) : sales.length === 0 ? (
          <p className="p-4 text-gray-500">No sales yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-600">
              <tr>
                <th className="p-3">Date</th>
                <th className="p-3">Items</th>
                <th className="p-3">Total</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {sales.map((sale) => (
                <Fragment key={sale.id}>
                  <tr className="border-t border-gray-100">
                    <td className="p-3 text-gray-700">
                      {formatDate(sale.createdAt)}
                    </td>
                    <td className="p-3 text-gray-600">
                      {sale.items.length} item
                      {sale.items.length > 1 ? 's' : ''}
                    </td>
                    <td className="p-3 font-medium text-gray-900">
                      Rs {sale.totalAmount}
                    </td>
                    <td className="p-3">
                      <button
                        onClick={() => toggleExpand(sale.id)}
                        className="text-sm text-blue-600 hover:underline"
                      >
                        {expandedId === sale.id ? 'Hide' : 'View'}
                      </button>
                    </td>
                  </tr>
                  {expandedId === sale.id && (
                    <tr className="bg-gray-50">
                      <td colSpan={4} className="p-3">
                        <div className="space-y-1">
                          {sale.items.map((item) => (
                            <div
                              key={item.id}
                              className="flex justify-between text-sm text-gray-600"
                            >
                              <span>
                                {item.productName} × {item.quantity}
                              </span>
                              <span>Rs {item.lineTotal}</span>
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}