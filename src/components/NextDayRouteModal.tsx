import React, { useMemo, useState } from 'react';
import { X, Route, Check, Users, AlertTriangle } from 'lucide-react';
import { Contact, LedgerEntry, MilkType } from '../types/dairy';
import { getDeviceTodayDate, shiftDateString, formatPKR, formatLiters } from '../utils/formatters';

interface NextDayRouteModalProps {
  contacts: Contact[];
  entries: LedgerEntry[];
  onClose: () => void;
  onConfirm: (routeEntries: Omit<LedgerEntry, 'id'>[]) => void;
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatRouteDateLabel(dateStr: string, prefix: string): string {
  const [, monthStr, dayStr] = dateStr.split('-');
  const monthIdx = parseInt(monthStr, 10) - 1;
  const day = parseInt(dayStr, 10);
  return `${prefix}, ${MONTH_NAMES[monthIdx] || ''} ${day}`;
}

export const NextDayRouteModal: React.FC<NextDayRouteModalProps> = ({
  contacts,
  entries,
  onClose,
  onConfirm,
}) => {
  const tomorrowDate = useMemo(() => shiftDateString(getDeviceTodayDate(), 1), []);
  const todayDate = useMemo(() => getDeviceTodayDate(), []);
  const [viewMode, setViewMode] = useState<'today' | 'tomorrow'>('tomorrow');
  const [selectedArea, setSelectedArea] = useState<string>('all');

  // Only active buyer (customer) contacts are eligible for a delivery route —
  // sellers are farmers the business buys from, not delivery customers.
  // Shift is always 'morning' — the route is a single daily list, no shift toggle.
  const eligibleContacts = useMemo(
    () => contacts.filter((c) => c.role === 'buyer' && c.status === 'active'),
    [contacts]
  );

  // Unique areas computed from the UNFILTERED eligible contacts, so the pill
  // list itself never shrinks as the user filters.
  const uniqueAreas = useMemo(() => {
    const areas = new Set<string>();
    eligibleContacts.forEach((c) => {
      if (c.area?.trim()) areas.add(c.area.trim());
    });
    return Array.from(areas).sort();
  }, [eligibleContacts]);

  // Single filtering source point — every row/total below derives from this,
  // so an area filter automatically scopes Pending/Already Added/Delivered/
  // Missing and all footer totals without duplicating any logic.
  const filteredContacts = useMemo(
    () => (selectedArea === 'all' ? eligibleContacts : eligibleContacts.filter((c) => c.area === selectedArea)),
    [eligibleContacts, selectedArea]
  );

  const rows = useMemo(
    () =>
      filteredContacts.map((c) => {
        // If a real entry already exists for tomorrow, show its ACTUAL saved
        // quantity/rate/amount — not the customer's default — since the two can
        // differ (e.g. a one-off larger order).
        const matchingEntry = entries.find(
          (e) => e.contactId === c.id && e.date === tomorrowDate && e.shift === 'morning'
        );
        if (matchingEntry) {
          return {
            contact: c,
            qty: matchingEntry.liters,
            rate: matchingEntry.ratePerLiter,
            amount: matchingEntry.totalAmount,
            alreadyExists: true,
          };
        }
        // Quantity/rate always come straight from the customer's profile — editing
        // their default quantity must be reflected here instantly.
        const qty = c.fixedQuantity || c.morningQuotaLiters || 2.0;
        const rate = c.defaultRate || 240;
        return { contact: c, qty, rate, amount: Math.round(qty * rate), alreadyExists: false };
      }),
    [filteredContacts, entries, tomorrowDate]
  );

  const pendingRows = rows.filter((r) => !r.alreadyExists);
  const alreadyAddedRows = rows.filter((r) => r.alreadyExists);

  // "Today" view: read-only cross-reference of the route's customers against today's
  // actual LedgerEntry records — matches on date only (any shift), since the goal is
  // simply "have we delivered to them today," not shift bookkeeping.
  const todayRows = useMemo(
    () =>
      filteredContacts.map((c) => {
        const matchingEntry = entries.find((e) => e.contactId === c.id && e.date === todayDate);
        if (matchingEntry) {
          return {
            contact: c,
            qty: matchingEntry.liters,
            rate: matchingEntry.ratePerLiter,
            amount: matchingEntry.totalAmount,
            delivered: true,
          };
        }
        const qty = c.fixedQuantity || c.morningQuotaLiters || 2.0;
        const rate = c.defaultRate || 240;
        return { contact: c, qty, rate, amount: Math.round(qty * rate), delivered: false };
      }),
    [filteredContacts, entries, todayDate]
  );

  const deliveredTodayRows = todayRows.filter((r) => r.delivered);
  const missingTodayRows = todayRows.filter((r) => !r.delivered);

  const totalDeliveredToday = deliveredTodayRows.reduce((sum, r) => sum + r.amount, 0);
  const totalPendingToday = missingTodayRows.reduce((sum, r) => sum + r.amount, 0);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(pendingRows.map((r) => r.contact.id))
  );

  const toggleContact = (contactId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(contactId)) next.delete(contactId);
      else next.add(contactId);
      return next;
    });
  };

  const checkedPendingRows = pendingRows.filter((r) => selectedIds.has(r.contact.id));

  // Footer total reflects ONLY confirmed deliveries (Already Added) — what you actually
  // need to prepare milk for. Pending customers are shown with checkboxes so they can
  // still be added via Confirm, but they're intentionally excluded from this total.
  const totalLiters = alreadyAddedRows.reduce((sum, r) => sum + r.qty, 0);
  const totalAmount = alreadyAddedRows.reduce((sum, r) => sum + r.amount, 0);

  const handleConfirm = () => {
    if (checkedPendingRows.length === 0) return;

    const routeEntries: Omit<LedgerEntry, 'id'>[] = checkedPendingRows.map((r) => ({
      contactId: r.contact.id,
      contactName: r.contact.name,
      contactRole: r.contact.role,
      date: tomorrowDate,
      timestamp: '07:00 AM',
      shift: 'morning',
      milkType: (r.contact.milkTypePref || 'buffalo') as MilkType,
      liters: r.qty,
      ratePerLiter: r.rate,
      totalAmount: r.amount,
      receivedAmount: 0,
      dueAmount: r.amount,
      paymentMode: 'credit',
      isAutoGenerated: true,
    }));

    onConfirm(routeEntries);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200 select-none">
      <div
        className="w-full max-w-md bg-glass-gradient rounded-3xl shadow-2xl overflow-hidden border border-[#D6E9E1] flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-[#1B4332] text-white px-5 py-4 flex items-center justify-between border-b border-white/10 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <Route className="w-5 h-5 text-white shrink-0" />
            <div className="min-w-0">
              <h2 className="text-sm font-black tracking-tight truncate">
                {viewMode === 'today' ? "Today's Route" : 'Next Day Route'}
              </h2>
              <p className="text-[11px] text-white/70 font-medium truncate">
                {viewMode === 'today'
                  ? formatRouteDateLabel(todayDate, 'Today')
                  : formatRouteDateLabel(tomorrowDate, 'Tomorrow')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/10 transition-colors cursor-pointer shrink-0"
            aria-label="Close"
          >
            <X className="w-4.5 h-4.5" />
          </button>
        </div>

        {/* Today / Tomorrow Toggle */}
        <div className="mx-4 mt-3 p-1 rounded-full bg-white border border-[#D6E9E1] flex items-center shadow-xs select-none shrink-0">
          <button
            type="button"
            onClick={() => setViewMode('today')}
            className={`flex-1 py-1.5 text-xs font-bold rounded-full transition-all cursor-pointer text-center ${
              viewMode === 'today' ? 'bg-[#0B8F68] text-white shadow-xs' : 'text-[#163B32] hover:text-[#0B8F68]'
            }`}
          >
            Today
          </button>
          <div className="h-3 w-px bg-[#D6E9E1] shrink-0" />
          <button
            type="button"
            onClick={() => setViewMode('tomorrow')}
            className={`flex-1 py-1.5 text-xs font-bold rounded-full transition-all cursor-pointer text-center ${
              viewMode === 'tomorrow' ? 'bg-[#0B8F68] text-white shadow-xs' : 'text-[#163B32] hover:text-[#0B8F68]'
            }`}
          >
            Tomorrow
          </button>
        </div>

        {/* Area Filter */}
        {uniqueAreas.length > 0 && (
          <div className="mx-4 mt-2 shrink-0 flex items-center gap-1.5 overflow-x-auto pb-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            <button
              type="button"
              onClick={() => setSelectedArea('all')}
              className={`shrink-0 px-3 py-1.5 rounded-full text-[11px] font-bold border transition-all cursor-pointer whitespace-nowrap ${
                selectedArea === 'all'
                  ? 'bg-[#0B8F68] text-white border-[#0B8F68] shadow-xs'
                  : 'bg-white text-[#163B32] border-[#D6E9E1] hover:border-[#0B8F68]/40'
              }`}
            >
              All Areas
            </button>
            {uniqueAreas.map((area) => (
              <button
                key={area}
                type="button"
                onClick={() => setSelectedArea(area)}
                className={`shrink-0 px-3 py-1.5 rounded-full text-[11px] font-bold border transition-all cursor-pointer whitespace-nowrap ${
                  selectedArea === area
                    ? 'bg-[#0B8F68] text-white border-[#0B8F68] shadow-xs'
                    : 'bg-white text-[#163B32] border-[#D6E9E1] hover:border-[#0B8F68]/40'
                }`}
              >
                {area}
              </button>
            ))}
          </div>
        )}

        {/* Customer List: grouped into Pending / Already Added (Tomorrow), or Delivered / Missing (Today) */}
        <div className="flex-1 min-h-0 overflow-y-auto px-4 pt-3 pb-2 space-y-2">
          {viewMode === 'today' ? (
            todayRows.length === 0 ? (
              <div className="py-10 text-center">
                <Users className="w-8 h-8 text-[#55756D]/60 mx-auto mb-2" />
                <p className="text-sm font-bold text-[#163B32]">
                  {selectedArea === 'all' ? 'No active customers found' : `No customers in ${selectedArea}`}
                </p>
              </div>
            ) : (
              <>
                {missingTodayRows.length > 0 && (
                  <>
                    <div className="flex items-center gap-1.5 px-1">
                      <span className="text-[11px] font-black uppercase tracking-wider text-amber-600">
                        Missing / Pending
                      </span>
                      <span className="text-[10px] font-bold text-[#55756D]">({missingTodayRows.length})</span>
                    </div>
                    {missingTodayRows.map((r) => (
                      <div
                        key={r.contact.id}
                        className="flex items-center justify-between gap-2.5 bg-amber-50/60 rounded-2xl px-3 py-2.5 border border-amber-200"
                      >
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <div className="w-5 h-5 rounded-md border-2 bg-amber-100 border-amber-300 flex items-center justify-center shrink-0">
                            <AlertTriangle className="w-3 h-3 text-amber-600 stroke-[2.5]" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-[#8a6116] truncate">{r.contact.name}</p>
                            <p className="text-[11px] text-amber-700/80 font-semibold">
                              Not delivered yet · expected {formatLiters(r.qty)}
                            </p>
                          </div>
                        </div>
                        <span className="text-xs font-black text-amber-700 shrink-0">
                          {formatPKR(r.amount)}
                        </span>
                      </div>
                    ))}
                  </>
                )}

                {deliveredTodayRows.length > 0 && (
                  <>
                    <div className="flex items-center gap-1.5 px-1 pt-2">
                      <span className="text-[11px] font-black uppercase tracking-wider text-[#0B8F68]">
                        Delivered Today
                      </span>
                      <span className="text-[10px] font-bold text-[#55756D]">
                        ({deliveredTodayRows.length})
                      </span>
                    </div>
                    {deliveredTodayRows.map((r) => (
                      <div
                        key={r.contact.id}
                        className="flex items-center justify-between gap-2.5 bg-white rounded-2xl px-3 py-2.5 border border-[#D6E9E1]"
                      >
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <div className="w-5 h-5 rounded-md border-2 bg-[#0B8F68] border-[#0B8F68] flex items-center justify-center shrink-0">
                            <Check className="w-3.5 h-3.5 text-white stroke-[3]" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-[#163B32] truncate">{r.contact.name}</p>
                            <p className="text-[11px] text-[#55756D] font-medium">
                              {formatLiters(r.qty)} · Rs{r.rate.toFixed(0)}/L
                            </p>
                          </div>
                        </div>
                        <span className="text-xs font-black text-[#163B32] shrink-0">
                          {formatPKR(r.amount)}
                        </span>
                      </div>
                    ))}
                  </>
                )}
              </>
            )
          ) : rows.length === 0 ? (
            <div className="py-10 text-center">
              <Users className="w-8 h-8 text-[#55756D]/60 mx-auto mb-2" />
              <p className="text-sm font-bold text-[#163B32]">
                {selectedArea === 'all' ? 'No active customers found' : `No customers in ${selectedArea}`}
              </p>
            </div>
          ) : (
            <>
              {pendingRows.length > 0 && (
                <>
                  <div className="flex items-center gap-1.5 px-1">
                    <span className="text-[11px] font-black uppercase tracking-wider text-[#0B8F68]">
                      Pending
                    </span>
                    <span className="text-[10px] font-bold text-[#55756D]">({pendingRows.length})</span>
                  </div>
                  {pendingRows.map((r) => {
                    const isChecked = selectedIds.has(r.contact.id);
                    return (
                      <div
                        key={r.contact.id}
                        onClick={() => toggleContact(r.contact.id)}
                        className="flex items-center justify-between gap-2.5 bg-white rounded-2xl px-3 py-2.5 border border-[#D6E9E1] hover:border-[#0B8F68]/40 transition-all cursor-pointer active:scale-[0.99]"
                      >
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <div
                            className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all ${
                              isChecked ? 'bg-[#0B8F68] border-[#0B8F68]' : 'bg-white border-[#D6E9E1]'
                            }`}
                          >
                            {isChecked && <Check className="w-3.5 h-3.5 text-white stroke-[3]" />}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-[#163B32] truncate">{r.contact.name}</p>
                            <p className="text-[11px] text-[#55756D] font-medium">
                              {formatLiters(r.qty)} · Rs{r.rate.toFixed(0)}/L
                            </p>
                          </div>
                        </div>
                        <span className="text-xs font-black text-[#163B32] shrink-0">
                          {formatPKR(r.amount)}
                        </span>
                      </div>
                    );
                  })}
                </>
              )}

              {alreadyAddedRows.length > 0 && (
                <>
                  <div className="flex items-center gap-1.5 px-1 pt-2">
                    <span className="text-[11px] font-black uppercase tracking-wider text-amber-600">
                      Already Added
                    </span>
                    <span className="text-[10px] font-bold text-[#55756D]">
                      ({alreadyAddedRows.length})
                    </span>
                  </div>
                  {alreadyAddedRows.map((r) => (
                    <div
                      key={r.contact.id}
                      className="flex items-center justify-between gap-2.5 bg-white rounded-2xl px-3 py-2.5 border border-[#D6E9E1] opacity-50 cursor-not-allowed"
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <div className="w-5 h-5 rounded-md border-2 bg-slate-200 border-slate-300 flex items-center justify-center shrink-0">
                          <Check className="w-3.5 h-3.5 text-slate-500 stroke-[3]" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-[#163B32] truncate">{r.contact.name}</p>
                          <p className="text-[11px] text-[#55756D] font-medium">
                            {formatLiters(r.qty)} · Rs{r.rate.toFixed(0)}/L
                          </p>
                        </div>
                      </div>
                      <span className="text-xs font-black text-[#163B32] shrink-0">
                        {formatPKR(r.amount)}
                      </span>
                    </div>
                  ))}
                </>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3.5 border-t border-[#D6E9E1] bg-white/70 shrink-0 space-y-2.5">
          {viewMode === 'today' ? (
            <div className="flex items-center justify-between text-xs font-bold">
              <span className="text-[#0B8F68]">
                Delivered: {formatPKR(totalDeliveredToday)} ({deliveredTodayRows.length})
              </span>
              <span className="text-amber-600">
                Pending: {formatPKR(totalPendingToday)} ({missingTodayRows.length})
              </span>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between text-xs font-bold text-[#55756D]">
                <span>
                  {checkedPendingRows.length} customer{checkedPendingRows.length !== 1 ? 's' : ''} selected
                </span>
                <span className="text-sm font-black text-[#163B32]">
                  Total: {formatLiters(totalLiters)} | {formatPKR(totalAmount)}
                </span>
              </div>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={checkedPendingRows.length === 0}
                className="w-full py-3.5 rounded-2xl bg-[#0B8F68] hover:bg-[#087A5A] active:bg-[#066B4D] disabled:opacity-40 disabled:cursor-not-allowed text-white font-black text-sm tracking-tight transition-all cursor-pointer shadow-sm"
              >
                Confirm Deliveries for Tomorrow
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
