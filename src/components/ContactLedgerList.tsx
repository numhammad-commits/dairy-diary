import React, { useState, useRef } from 'react';
import { Plus, UserPlus, Phone, ChevronRight, Edit2, Trash2, AlertTriangle, X } from 'lucide-react';
import { Contact, LedgerEntry, PaymentRecord } from '../types/dairy';
import { formatPKR, parseEntryDateTime, formatRelativeActivityTime, getDeviceTodayDate, getDeviceCurrentMonthKey } from '../utils/formatters';
import { getCustomerMonthDue } from '../utils/calculations';

interface ContactLedgerListProps {
  contacts: Contact[];
  entries?: LedgerEntry[];
  paymentRecords?: PaymentRecord[];
  currentMonthKey?: string;
  onSelectContact: (contact: Contact) => void;
  onQuickAdd: (contact: Contact) => void;
  onOpenAddUser: () => void;
  onEditContact?: (contact: Contact) => void;
  onDeleteContact?: (contactId: string) => void;
}

export const ContactLedgerList: React.FC<ContactLedgerListProps> = ({
  contacts,
  entries = [],
  paymentRecords = [],
  currentMonthKey,
  onSelectContact,
  onQuickAdd,
  onOpenAddUser,
  onEditContact,
  onDeleteContact,
}) => {
  const [activeMenuContact, setActiveMenuContact] = useState<Contact | null>(null);
  const [deleteTargetContact, setDeleteTargetContact] = useState<Contact | null>(null);

  const timerRef = useRef<any>(null);
  const isLongPressRef = useRef<boolean>(false);
  const startPosRef = useRef<{ x: number; y: number } | null>(null);

  const handleTouchStart = (contact: Contact, e: React.TouchEvent) => {
    isLongPressRef.current = false;
    const touch = e.touches[0];
    startPosRef.current = { x: touch.clientX, y: touch.clientY };

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      isLongPressRef.current = true;
      setActiveMenuContact(contact);
    }, 500);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!startPosRef.current) return;
    const touch = e.touches[0];
    const dist = Math.hypot(touch.clientX - startPosRef.current.x, touch.clientY - startPosRef.current.y);
    if (dist > 8) {
      if (timerRef.current) clearTimeout(timerRef.current);
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (isLongPressRef.current) {
      e.preventDefault();
      setTimeout(() => {
        isLongPressRef.current = false;
      }, 100);
    }
  };

  const handleMouseDown = (contact: Contact, e: React.MouseEvent) => {
    if (e.button !== 0) return;
    isLongPressRef.current = false;
    startPosRef.current = { x: e.clientX, y: e.clientY };

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      isLongPressRef.current = true;
      setActiveMenuContact(contact);
    }, 500);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!startPosRef.current) return;
    const dist = Math.hypot(e.clientX - startPosRef.current.x, e.clientY - startPosRef.current.y);
    if (dist > 8) {
      if (timerRef.current) clearTimeout(timerRef.current);
    }
  };

  const handleMouseUp = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (isLongPressRef.current) {
      setTimeout(() => {
        isLongPressRef.current = false;
      }, 100);
    }
  };

  // Helper to compute relative time strictly from the customer's MOST RECENT MILK ENTRY
  const getContactActivityLabel = (contact: Contact) => {
    let latestDate: Date | null = null;
    let latestTimeStr = '';

    // Check all MILK deliveries for this customer ONLY
    if (entries && entries.length > 0) {
      for (const e of entries) {
        const isMatch =
          e.contactId === contact.id ||
          Boolean(
            e.contactName &&
              contact.name &&
              e.contactName.trim().toLowerCase() === contact.name.trim().toLowerCase()
          );

        if (isMatch && e.date) {
          const parsed = parseEntryDateTime(e.date, e.timestamp);
          if (!latestDate || parsed.getTime() > latestDate.getTime()) {
            latestDate = parsed;
            latestTimeStr = e.timestamp || '';
          }
        }
      }
    }

    if (latestDate) {
      return formatRelativeActivityTime(latestDate, latestTimeStr);
    }

    return 'No entries yet';
  };

  if (contacts.length === 0) {
    return (
      <div className="mx-3 my-4 py-10 px-6 text-center flex flex-col items-center justify-center glass-card rounded-2xl">
        <div className="w-14 h-14 rounded-full bg-[#E1F3EA] border border-[#D6E9E1] flex items-center justify-center text-[#0B8F68] mb-3 shadow-xs">
          <UserPlus className="w-7 h-7" />
        </div>
        <h3 className="text-base font-bold text-[#163B32]">No records found</h3>
        <p className="text-xs text-[#55756D] max-w-xs mt-1">
          No dairy suppliers or customers match your search or filter criteria.
        </p>
        <button
          onClick={onOpenAddUser}
          className="mt-4 px-4 py-2 bg-[#0B8F68] hover:bg-[#087A5A] text-white rounded-full text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-sm"
        >
          <Plus className="w-4 h-4" />
          <span>Add New Contact</span>
        </button>
      </div>
    );
  }

  const avatarColors = ['#0B8F68', '#E5485D', '#0B9B72', '#7B2CBF'];

  return (
    <div className="space-y-2 px-3 py-1 relative select-none">
      {contacts.map((contact, index) => {
        const initial = contact.name.trim().charAt(0).toUpperCase();
        const todayDateStr = getDeviceTodayDate();
        const hasEntryToday = Boolean(
          entries &&
            entries.some(
              (e) =>
                (e.contactId === contact.id ||
                  Boolean(
                    e.contactName &&
                      contact.name &&
                      e.contactName.trim().toLowerCase() === contact.name.trim().toLowerCase()
                  )) &&
                e.date === todayDateStr
            )
        );

        const avatarBg = avatarColors[index % avatarColors.length];

        return (
          <div
            key={contact.id}
            onTouchStart={(e) => handleTouchStart(contact, e)}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onTouchCancel={() => {
              if (timerRef.current) clearTimeout(timerRef.current);
              isLongPressRef.current = false;
            }}
            onMouseDown={(e) => handleMouseDown(contact, e)}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={() => {
              if (timerRef.current) clearTimeout(timerRef.current);
            }}
            onContextMenu={(e) => {
              if (isLongPressRef.current) {
                e.preventDefault();
              }
            }}
            onClick={() => {
              if (isLongPressRef.current) return;
              onSelectContact(contact);
            }}
            className="bg-white rounded-2xl px-3.5 py-3 flex items-center justify-between gap-3 border border-[#D6E9E1] hover:border-[#0B8F68]/30 hover:shadow-md transition-all cursor-pointer select-none group shadow-xs active:scale-[0.99]"
          >
            {/* Left: Avatar with Status Dot + Name & Timestamp */}
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="relative shrink-0">
                <div
                  className="w-11 h-11 rounded-full flex items-center justify-center text-white font-bold text-base shadow-xs transition-colors duration-200"
                  style={{ backgroundColor: avatarBg }}
                >
                  {initial}
                </div>
                {/* Active indicator dot: green if this customer has an entry today, red otherwise */}
                <span
                  className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 border-2 border-white rounded-full ${
                    hasEntryToday ? 'bg-green-500' : 'bg-red-500'
                  }`}
                />
              </div>

              {/* Name & Timestamp */}
              <div className="min-w-0 flex-1 pr-1">
                <h4 className="text-base font-bold text-[#163B32] tracking-tight leading-snug break-words line-clamp-2 group-hover:text-[#0B8F68]">
                  {contact.name}
                </h4>
                <p className="text-sm text-[#55756D] font-medium mt-0.5 truncate flex items-center gap-1">
                  <span>{getContactActivityLabel(contact)}</span>
                </p>
              </div>
            </div>

            {/* Right: Due Amount + "+ Add" Button */}
            <div className="flex items-center gap-2.5 shrink-0">
              {/* Due Amount - Dynamically computed from entries + payments */}
              {(() => {
                const fin = getCustomerMonthDue(contact, currentMonthKey || getDeviceCurrentMonthKey(), entries, paymentRecords);
                const currentDue = fin.due;
                const prevDue = fin.previousDue;
                return (
                  <div className="text-right">
                    <span
                      className={`text-sm font-black tracking-tight block ${
                        currentDue > 0 ? 'text-[#E5485D]' : 'text-[#55756D]'
                      }`}
                    >
                      Due: {formatPKR(currentDue)}
                    </span>
                    {prevDue > 0 && (
                      <span className="text-[10px] text-amber-700 font-bold block -mt-0.5">
                        Prev: {formatPKR(prevDue)}
                      </span>
                    )}
                  </div>
                );
              })()}

              {/* "+ Add" Button */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onQuickAdd(contact);
                }}
                className="flex items-center justify-center gap-1 px-3 py-1.5 rounded-full bg-white hover:bg-[#E1F3EA] active:bg-[#D6E9E1] text-[#0B8F68] border border-[#D6E9E1] active:scale-95 transition-all text-xs font-bold cursor-pointer shadow-xs"
                title={`Quick add milk entry for ${contact.name}`}
              >
                <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>Add</span>
              </button>
            </div>
          </div>
        );
      })}

      {/* Long-Press Popup Menu */}
      {activeMenuContact && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-2xs animate-in fade-in select-none"
          onClick={() => setActiveMenuContact(null)}
        >
          <div
            className="w-full max-w-xs bg-white rounded-3xl p-3 shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-150 space-y-1"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header with Contact Info */}
            <div className="px-3 py-2 border-b border-slate-100 flex items-center justify-between">
              <div className="min-w-0 pr-2">
                <p className="text-xs font-black text-slate-900 truncate">
                  {activeMenuContact.name}
                </p>
                <p className="text-[10px] text-slate-400 font-semibold truncate">
                  {activeMenuContact.phone || (activeMenuContact.role === 'buyer' ? 'Buyer' : 'Seller')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveMenuContact(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Option 1: Edit */}
            <button
              type="button"
              onClick={() => {
                const target = activeMenuContact;
                setActiveMenuContact(null);
                if (onEditContact) onEditContact(target);
              }}
              className="w-full px-3 py-2.5 text-left hover:bg-emerald-50 active:bg-emerald-100 rounded-xl flex items-center gap-2.5 cursor-pointer text-[#1E5631] font-bold text-xs transition-colors"
            >
              <Edit2 className="w-4 h-4 text-[#1E5631]" />
              <span>Edit Customer Profile</span>
            </button>

            {/* Option 2: Delete */}
            <button
              type="button"
              onClick={() => {
                const target = activeMenuContact;
                setActiveMenuContact(null);
                setDeleteTargetContact(target);
              }}
              className="w-full px-3 py-2.5 text-left hover:bg-rose-50 active:bg-rose-100 rounded-xl flex items-center gap-2.5 cursor-pointer text-rose-600 font-bold text-xs transition-colors border-t border-slate-100"
            >
              <Trash2 className="w-4 h-4 text-rose-600" />
              <span>Delete Customer</span>
            </button>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {deleteTargetContact && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in select-none"
          onClick={() => setDeleteTargetContact(null)}
        >
          <div
            className="w-full max-w-sm bg-white rounded-3xl p-5 shadow-2xl space-y-4 border border-rose-100"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2.5 text-rose-600">
              <div className="w-9 h-9 rounded-full bg-rose-100 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h3 className="font-extrabold text-sm text-slate-900 leading-tight">
                  Delete {deleteTargetContact.name}?
                </h3>
                <p className="text-[11px] text-slate-500 font-medium">
                  This action cannot be undone
                </p>
              </div>
            </div>

            <div className="space-y-2 text-xs text-slate-600 leading-relaxed">
              <p>
                Delete <span className="font-bold text-slate-800">{deleteTargetContact.name}</span>? This will remove all their entries, payments, and history. This cannot be undone.
              </p>

              {(() => {
                const fin = getCustomerMonthDue(deleteTargetContact, currentMonthKey || getDeviceCurrentMonthKey(), entries, paymentRecords);
                const totalUnpaid = fin.due + fin.previousDue;
                if (totalUnpaid <= 0) return null;
                return (
                  <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-bold flex items-start gap-1.5">
                    <span className="shrink-0">⚠️</span>
                    <span>
                      This customer has an outstanding balance of {formatPKR(totalUnpaid)}. Delete anyway?
                    </span>
                  </div>
                );
              })()}
            </div>

            <div className="flex items-center gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => setDeleteTargetContact(null)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const id = deleteTargetContact.id;
                  setDeleteTargetContact(null);
                  if (onDeleteContact) {
                    onDeleteContact(id);
                  }
                }}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white rounded-xl text-xs font-black shadow-sm transition-colors cursor-pointer"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
