/**
 * Plastic Job Work — record schemas.
 *
 * Each schema is the source of truth for a record's fields. The normalizer
 * (makeNormalizer) fills defaults on read, so adding a field later never breaks
 * old records.
 */
import { field } from '../../core/schema/field'
import { todayStr } from '../../core/utils/format'

/**
 * PRODUCTION entry — one molding run (a date + molder + the shift(s) worked +
 * the products returned). Supports multiple products in one shift.
 *   items: [{ productId, pieces, rejects, rejectRows }]
 *     rejectRows: [{ reason, qty }] — per-reason QC breakdown (config.REJECT_REASONS);
 *     rejects = sum of the rows, kept for costing/reconciliation. Old entries
 *     instead carry a single rejectReason; Dashboard reads both shapes. Additive.
 *   costSnapshot: computed { perProduct:[{productId, costPerPiece, ...}], ... }
 *                 stored at save time so history keeps its locked rates.
 */
export const productionSchema = [
  field({ name: 'entryNo',     label: 'Entry No',   type: 'text',   default: '', required: true }),
  field({ name: 'date',        label: 'Date',       type: 'date',   default: todayStr, required: true }),
  field({ name: 'molderId',    label: 'Molder',     type: 'text',   default: '', required: true }),
  // Optional material-lot tag (LOT-01…) linking this run to the raw-material
  // lot it was made from, for the per-lot reconciliation report. '' = unassigned.
  field({ name: 'lotNo',       label: 'Lot',        type: 'text',   default: '' }),
  field({ name: 'shifts',      label: 'Shifts',     type: 'number', default: 1, required: true }),
  // Actual hours the machine ran this entry. When > 0, job-work is charged
  // pro-rata (hours ÷ 12 × shift-rate) instead of by whole shifts. 0 = use shifts.
  field({ name: 'hours',       label: 'Hours run',  type: 'number', default: 0 }),
  // Pay method for this entry: '' = use molder default, else 'time' | 'piece'.
  field({ name: 'payMode',     label: 'Pay mode',   type: 'text',   default: '' }),
  field({ name: 'pieceRate',   label: 'Piece rate', type: 'number', default: 0 }),
  // Set when the entry's lot is finalized: pay frozen so rate changes can't
  // alter settled dues. Cleared on reopen.
  field({ name: 'locked',        label: 'Locked',         type: 'toggle', default: false }),
  field({ name: 'lockedJobWork', label: 'Frozen job-work', type: 'number', default: 0 }),
  // Machine's shot counter reading for this run — pieces = shots × cavities is
  // the objective output the machine itself logs (0 = not recorded).
  field({ name: 'machineShots', label: 'Machine shots', type: 'number', default: 0 }),
  field({ name: 'items',       label: 'Items',      type: 'list',   default: () => [], required: true }),
  field({ name: 'runnerKg',    label: 'Runner returned (kg)', type: 'number', default: 0 }),
  field({ name: 'rejectsKg',   label: 'Rejects returned (kg)', type: 'number', default: 0 }),
  field({ name: 'burntKg',     label: 'Burnt / purge loss (kg)', type: 'number', default: 0 }),
  field({ name: 'finishedKg',  label: 'Finished weight (kg)', type: 'number', default: 0 }),
  field({ name: 'note',        label: 'Note',       type: 'text',   default: '' }),
  field({ name: 'costSnapshot', label: 'Cost snapshot', type: 'list', default: () => ({}) }),
  field({ name: 'voided',      label: 'Voided',     type: 'toggle', default: false }),
  field({ name: 'voidReason',  label: 'Void reason', type: 'text',  default: '' }),
]

/**
 * ISSUE — compound / masterbatch / nuts handed to a molder (bulk or per-job).
 * Builds the molder's running material balance.
 */
export const issueSchema = [
  field({ name: 'date',       label: 'Date',       type: 'date',   default: todayStr, required: true }),
  field({ name: 'molderId',   label: 'Molder',     type: 'text',   default: '', required: true }),
  // Material-lot tag (LOT-01…) — issuing material opens/extends a lot.
  field({ name: 'lotNo',      label: 'Lot',        type: 'text',   default: '' }),
  field({ name: 'compoundId', label: 'Compound',   type: 'text',   default: '' }),
  field({ name: 'compoundKg', label: 'Compound (kg)', type: 'number', default: 0 }),
  // which product this compound is meant for — used to estimate expected pieces
  field({ name: 'productId',  label: 'For product', type: 'text',   default: '' }),
  field({ name: 'mbId',       label: 'Masterbatch', type: 'text',  default: '' }),
  field({ name: 'mbKg',       label: 'Masterbatch (kg)', type: 'number', default: 0 }),
  field({ name: 'insertId',   label: 'Nut/Insert', type: 'text',   default: '' }),
  field({ name: 'nutKg',      label: 'Nuts (kg)',  type: 'number', default: 0 }),
  field({ name: 'nutQty',     label: 'Nuts (qty)', type: 'number', default: 0 }),
  // per-lot nut weight (g/nut) used to convert this supply's kg → count. 0 = use
  // the master weight. Nut size can differ lot to lot, so we capture it per entry.
  field({ name: 'nutWeightG', label: 'Nut weight (g)', type: 'number', default: 0 }),
  field({ name: 'note',       label: 'Note',       type: 'text',   default: '' }),
  field({ name: 'voided',     label: 'Voided',     type: 'toggle', default: false }),
]

/**
 * RETURN — material the molder physically HANDS BACK (unused virgin compound,
 * loose regrind/runner, and/or nuts). Reduces the molder's running balance.
 * Counterpart to ISSUE (ISSUE adds to balance, RETURN removes). Additive —
 * molders with no returns reconcile exactly as before.
 */
export const returnSchema = [
  field({ name: 'date',       label: 'Date',       type: 'date',   default: todayStr, required: true }),
  field({ name: 'molderId',   label: 'Molder',     type: 'text',   default: '', required: true }),
  field({ name: 'lotNo',      label: 'Lot',        type: 'text',   default: '' }),
  field({ name: 'compoundId', label: 'Compound',   type: 'text',   default: '' }),
  field({ name: 'compoundKg', label: 'Compound returned (kg)', type: 'number', default: 0 }),
  field({ name: 'regrindKg',  label: 'Regrind returned (kg)',  type: 'number', default: 0 }),
  field({ name: 'insertId',   label: 'Nut/Insert', type: 'text',   default: '' }),
  field({ name: 'nutKg',      label: 'Nuts returned (kg)', type: 'number', default: 0 }),
  field({ name: 'nutQty',     label: 'Nuts returned (qty)', type: 'number', default: 0 }),
  field({ name: 'nutWeightG', label: 'Nut weight (g)', type: 'number', default: 0 }),
  field({ name: 'note',       label: 'Note',       type: 'text',   default: '' }),
  field({ name: 'voided',     label: 'Voided',     type: 'toggle', default: false }),
]

/**
 * PURCHASE — raw material bought into the owner's store, with its OWN lot price
 * (compound/nut prices vary per purchase). Stock on hand is DERIVED:
 *   stock = Σ purchases − Σ issued to molders + Σ returned by molders.
 *   kind: 'compound' | 'nut' | 'masterbatch'; materialId points into that master.
 *   qty: kg (compound/masterbatch) or pieces (nut). rate: ₹/kg or ₹/each.
 */
export const purchaseSchema = [
  field({ name: 'date',       label: 'Date',     type: 'date',   default: todayStr, required: true }),
  field({ name: 'kind',       label: 'Material', type: 'text',   default: 'compound', required: true }),
  field({ name: 'materialId', label: 'Item',     type: 'text',   default: '' }),
  field({ name: 'qty',        label: 'Quantity', type: 'number', default: 0, required: true }),
  field({ name: 'rate',       label: 'Lot rate', type: 'number', default: 0 }),
  field({ name: 'supplier',   label: 'Supplier', type: 'text',   default: '' }),
  field({ name: 'invoice',    label: 'Invoice',  type: 'text',   default: '' }),
  field({ name: 'note',       label: 'Note',     type: 'text',   default: '' }),
  field({ name: 'voided',     label: 'Voided',   type: 'toggle', default: false }),
]

/**
 * PAYMENT — money to a molder. kind: 'payment' (settling dues) | 'advance'.
 */
export const paymentSchema = [
  field({ name: 'date',     label: 'Date',   type: 'date',   default: todayStr, required: true }),
  field({ name: 'molderId', label: 'Molder', type: 'text',   default: '', required: true }),
  field({ name: 'amount',   label: 'Amount', type: 'number', default: 0, required: true }),
  field({ name: 'kind',     label: 'Kind',   type: 'select', default: 'payment',
          options: [{ value: 'payment', label: 'Payment' }, { value: 'advance', label: 'Advance' }] }),
  field({ name: 'note',     label: 'Note',   type: 'text',   default: '' }),
  field({ name: 'voided',   label: 'Voided', type: 'toggle', default: false }),
]

/** App user for role-based access (used only in cloud mode). */
export const userSchema = [
  field({ name: 'email',  label: 'Email',  type: 'text',   default: '', required: true }),
  field({ name: 'name',   label: 'Name',   type: 'text',   default: '' }),
  field({ name: 'role',   label: 'Role',   type: 'text',   default: 'manager' }),
  field({ name: 'active', label: 'Active', type: 'toggle', default: true }),
]
