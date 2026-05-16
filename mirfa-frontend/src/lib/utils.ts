import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, formatDistanceToNow, parseISO } from 'date-fns'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date?: string | null): string {
  if (!date) return '—'
  try { return format(parseISO(date), 'dd MMM yyyy') } catch { return date }
}

export function formatDateTime(date?: string | null): string {
  if (!date) return '—'
  try { return format(parseISO(date), 'dd MMM yyyy, HH:mm') } catch { return date }
}

export function formatRelative(date?: string | null): string {
  if (!date) return '—'
  try { return formatDistanceToNow(parseISO(date), { addSuffix: true }) } catch { return date }
}

export function formatCurrency(amount?: number | null, currency = 'AED'): string {
  if (amount == null) return '—'
  return new Intl.NumberFormat('en-AE', {
    style: 'currency', currency,
    minimumFractionDigits: 2,
  }).format(amount)
}

export function formatNumber(n?: number | null): string {
  if (n == null) return '—'
  return new Intl.NumberFormat('en-AE').format(n)
}

export const STATUS_COLORS: Record<string, string> = {
  pending:        'bg-yellow-100 text-yellow-800',
  assigned:       'bg-blue-100 text-blue-800',
  in_progress:    'bg-indigo-100 text-indigo-800',
  completed:      'bg-green-100 text-green-800',
  cancelled:      'bg-red-100 text-red-800',
  on_hold:        'bg-gray-100 text-gray-800',
  draft:          'bg-gray-100 text-gray-700',
  sent:           'bg-blue-100 text-blue-700',
  partially_paid: 'bg-orange-100 text-orange-700',
  paid:           'bg-green-100 text-green-700',
  overdue:        'bg-red-100 text-red-700',
  credit_note:    'bg-purple-100 text-purple-700',
  accepted:       'bg-green-100 text-green-700',
  rejected:       'bg-red-100 text-red-700',
  expired_doc:    'bg-red-100 text-red-800',
  critical:       'bg-red-50 text-red-700',
  warning:        'bg-yellow-50 text-yellow-700',
  notice:         'bg-blue-50 text-blue-700',
  expired_status: 'bg-gray-100 text-gray-500',
  converted:      'bg-teal-100 text-teal-700',
  available:      'bg-green-100 text-green-700',
  on_job:         'bg-blue-100 text-blue-700',
  off_duty:       'bg-gray-100 text-gray-700',
  on_leave:       'bg-orange-100 text-orange-700',
}

export function getStatusColor(status: string): string {
  return STATUS_COLORS[status] ?? 'bg-gray-100 text-gray-600'
}

export function getUrgencyColor(days?: number): string {
  if (days == null) return ''
  if (days < 0)  return 'text-red-700 bg-red-50'
  if (days <= 7)  return 'text-red-600 bg-red-50'
  if (days <= 30) return 'text-yellow-700 bg-yellow-50'
  return 'text-blue-700 bg-blue-50'
}
