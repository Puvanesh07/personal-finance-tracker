// src/components/investments/SellInvestmentModal.tsx

import { FiSave, FiTrendingDown, FiTrendingUp } from 'react-icons/fi';
import { currentValue, investedValue } from '../../utils/calculations';
import { useEffect, useState } from 'react';

import type { Investment } from '../../types/investmentTypes';
import { Modal } from '../ui/Modal';
import { NumericInput } from '../ui/NumericInput';
import { CalendarPicker } from '../ui/CalendarPicker';
import { formatINR } from '../../utils/format';
import { todayISO } from '../../utils/dateUtils';
import { usePortfolioStore } from '../../store/portfolioStore';

type Props = { open: boolean; onClose: () => void; investment: Investment };

export function SellInvestmentModal({ open, onClose, investment }: Props) {
  const addSoldTrade = usePortfolioStore((s) => s.addSoldTrade);
  const updateInvestment = usePortfolioStore((s) => s.updateInvestment);
  const deleteInvestment = usePortfolioStore((s) => s.deleteInvestment);

  const totalQty: number =
    (investment as any).quantity ?? (investment as any).units ?? 0;
  const hasQty = totalQty > 0;

  const originalInvested = investedValue(investment);
  const originalCurrentVal = currentValue(investment);

  const perUnitBuyPrice =
    hasQty && totalQty > 0 ? originalInvested / totalQty : 0;
  const perUnitSellPrice =
    hasQty && totalQty > 0 ? originalCurrentVal / totalQty : 0;

  const [sellQtyStr, setSellQtyStr] = useState(
    String(totalQty > 0 ? totalQty : ''),
  );
  const [sellTotal, setSellTotal] = useState(
    String(originalCurrentVal.toFixed(2)),
  );
  const [buyTotal, setBuyTotal] = useState(String(originalInvested.toFixed(2)));
  const [soldDate, setSoldDate] = useState(todayISO());
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!hasQty || !sellQtyStr) return;
    const qty = parseFloat(sellQtyStr);
    if (isNaN(qty) || qty <= 0) return;
    const ratio = Math.min(qty, totalQty) / totalQty;
    setBuyTotal((originalInvested * ratio).toFixed(2));
    setSellTotal((originalCurrentVal * ratio).toFixed(2));
  }, [sellQtyStr]);

  useEffect(() => {
    if (open) {
      setSellQtyStr(String(totalQty > 0 ? totalQty : ''));
      setSellTotal(String(originalCurrentVal.toFixed(2)));
      setBuyTotal(String(originalInvested.toFixed(2)));
      setSoldDate(todayISO());
      setNotes('');
    }
  }, [open]);

  const sellQty = parseFloat(sellQtyStr) || 0;
  const buy = parseFloat(buyTotal) || 0;
  const sell = parseFloat(sellTotal) || 0;
  const profit = sell - buy;
  const profitPct = buy > 0 ? (profit / buy) * 100 : 0;
  const isProfit = profit >= 0;
  const isSellingAll = !hasQty || sellQty >= totalQty;
  const remainingQty = hasQty ? Math.max(0, totalQty - sellQty) : 0;

  async function handleSubmit() {
    setSaving(true);
    try {
      await addSoldTrade({
        investmentName: investment.name,
        investmentType: investment.type,
        symbol: (investment as any).symbol,
        platform: investment.platform,
        quantity: hasQty ? sellQty : undefined,
        buyPrice: buy,
        sellPrice: sell,
        soldDate,
        notes: notes.trim() || undefined,
      });

      if (hasQty && !isSellingAll && remainingQty > 0) {
        const patch: any = {};
        if ((investment as any).quantity !== undefined)
          patch.quantity = remainingQty;
        else if ((investment as any).units !== undefined)
          patch.units = remainingQty;
        const remainingRatio = remainingQty / totalQty;
        if ((investment as any).investedAmount !== undefined) {
          patch.investedAmount = originalInvested * remainingRatio;
        }
        await updateInvestment(investment.id, patch);
      } else {
        await deleteInvestment(investment.id);
      }
      onClose();
    } finally {
      setSaving(false);
    }
  }

  const inputCls =
    'w-full rounded-xl border border-slate-300/80 dark:border-slate-700/80 bg-slate-50 dark:bg-slate-900/50 px-4 py-2.5 text-sm font-medium text-slate-900 dark:text-slate-100 shadow-sm outline-none transition-all focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20 placeholder:text-slate-500 dark:placeholder:text-slate-500 dark:text-slate-400';
  const labelCls =
    'text-[11px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-1.5 block ml-1';

  return (
    <Modal open={open} onClose={onClose} title='Record Sale & Track Profit'>
      <div className='space-y-5'>
        {/* Asset info banner */}
        <div className='rounded-xl border border-slate-300/70 dark:border-slate-700/60 bg-slate-100 dark:bg-slate-800/50 px-4 py-3 flex items-center gap-3'>
          <div className='flex-1 min-w-0'>
            <p className='font-bold text-slate-900 dark:text-slate-100 text-sm truncate'>
              {investment.name}
            </p>
            <p className='text-[11px] text-slate-900 dark:text-slate-400 mt-0.5 capitalize'>
              {investment.type.replace('_', ' ')} ·{' '}
              {investment.platform ?? 'Manual'}
            </p>
          </div>
          <div className='text-right shrink-0'>
            <p className='text-[10px] text-slate-900 dark:text-slate-400'>Portfolio Value</p>
            <p className='text-sm font-bold text-white'>
              {formatINR(originalCurrentVal)}
            </p>
            {hasQty && (
              <p className='text-[10px] text-slate-900 dark:text-slate-400 mt-0.5'>
                {totalQty} units total
              </p>
            )}
          </div>
        </div>

        {/* Quantity field */}
        {hasQty && (
          <div>
            <label className={labelCls}>
              Quantity to Sell{' '}
              <span className='text-slate-500 dark:text-slate-400 font-normal normal-case tracking-normal'>
                (max: {totalQty})
              </span>
            </label>
            <NumericInput
              className={inputCls}
              value={sellQtyStr}
              onChange={(v) => {
                const num = parseFloat(v);
                if (!isNaN(num) && num > totalQty)
                  setSellQtyStr(String(totalQty));
                else setSellQtyStr(v);
              }}
            />
            {sellQty > 0 && (
              <div className='mt-2'>
                {isSellingAll ? (
                  <span className='inline-flex items-center gap-1.5 rounded-lg bg-rose-500/10 border border-rose-500/20 px-2.5 py-1 text-[11px] font-bold text-rose-400'>
                    🗑 Full position will be removed from portfolio
                  </span>
                ) : (
                  <span className='inline-flex items-center gap-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 text-[11px] font-bold text-amber-400'>
                    📊{' '}
                    {remainingQty.toLocaleString('en-IN', {
                      maximumFractionDigits: 4,
                    })}{' '}
                    units will remain
                  </span>
                )}
              </div>
            )}
            {perUnitSellPrice > 0 && (
              <p className='text-[10px] text-slate-500 dark:text-slate-400 mt-1 ml-1'>
                ~{formatINR(perUnitSellPrice)} per unit (current) · ~
                {formatINR(perUnitBuyPrice)} per unit (buy)
              </p>
            )}
          </div>
        )}

        {/* Buy & Sell totals */}
        <div className='grid grid-cols-2 gap-4'>
          <div>
            <label className={labelCls}>Total Buy Cost (₹)</label>
            <NumericInput
              className={inputCls}
              value={buyTotal}
              onChange={setBuyTotal}
            />
            <p className='text-[10px] text-slate-500 dark:text-slate-400 mt-1 ml-1'>
              Original invested amount
            </p>
          </div>
          <div>
            <label className={labelCls}>Total Sell Value (₹)</label>
            <NumericInput
              className={inputCls}
              value={sellTotal}
              onChange={setSellTotal}
            />
            <p className='text-[10px] text-slate-500 dark:text-slate-400 mt-1 ml-1'>
              Amount credited to bank
            </p>
          </div>
        </div>

        {/* Live Profit Preview */}
        <div
          className={`rounded-2xl border p-4 flex items-center gap-4 ${isProfit ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-rose-500/20 bg-rose-500/5'}`}
        >
          <div
            className={`flex h-10 w-10 items-center justify-center rounded-xl shrink-0 ${isProfit ? 'bg-emerald-500/15' : 'bg-rose-500/15'}`}
          >
            {isProfit ? (
              <FiTrendingUp className='h-5 w-5 text-emerald-400' />
            ) : (
              <FiTrendingDown className='h-5 w-5 text-rose-400' />
            )}
          </div>
          <div className='flex-1'>
            <p className='text-[11px] font-bold uppercase tracking-wider text-slate-900 dark:text-slate-400'>
              {isProfit ? 'Realized Profit' : 'Realized Loss'}
            </p>
            <p
              className={`text-2xl font-bold tabular-nums mt-0.5 ${isProfit ? 'text-emerald-400' : 'text-rose-400'}`}
            >
              {isProfit ? '+' : ''}
              {formatINR(profit)}
            </p>
          </div>
          <div
            className={`text-right ${isProfit ? 'text-emerald-500' : 'text-rose-500'}`}
          >
            <p className='text-[11px] font-bold uppercase tracking-wider text-slate-900 dark:text-slate-400'>
              Return
            </p>
            <p className='text-lg font-bold tabular-nums mt-0.5'>
              {isProfit ? '▲' : '▼'} {Math.abs(profitPct).toFixed(2)}%
            </p>
          </div>
        </div>

        {/* Date */}
        <div>
          <label className={labelCls}>Date of Sale</label>
          <CalendarPicker
            value={soldDate}
            onChange={setSoldDate}
            placeholder='Select sale date'
          />
        </div>

        {/* Notes */}
        <div>
          <label className={labelCls}>Notes (optional)</label>
          <textarea
            className={`${inputCls} resize-none h-16`}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder='e.g. Sold due to target reached, booked profits...'
          />
        </div>

        {/* Actions */}
        <div className='flex items-center justify-end gap-3 border-t border-slate-200/70 dark:border-slate-800/60 pt-4'>
          <button
            type='button'
            onClick={onClose}
            disabled={saving}
            className='rounded-xl px-5 py-2.5 text-sm font-bold text-slate-600 dark:text-slate-200 transition-colors hover:bg-slate-200 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white disabled:opacity-50'
          >
            Cancel
          </button>
          <button
            type='button'
            onClick={() => void handleSubmit()}
            disabled={
              saving || buy <= 0 || sell <= 0 || (hasQty && sellQty <= 0)
            }
            className='inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-emerald-500/25 transition-all hover:-translate-y-0.5 disabled:opacity-60 disabled:hover:translate-y-0'
          >
            <FiSave className={`h-4 w-4 ${saving ? 'animate-pulse' : ''}`} />
            {saving
              ? 'Saving…'
              : isSellingAll
                ? 'Record Sale & Remove'
                : 'Record Partial Sale'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
