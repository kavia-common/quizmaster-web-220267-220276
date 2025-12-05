import type { CategoryKey } from '@/stores/quiz'
import { useOfflineStore } from '@/stores/offline'

// PUBLIC_INTERFACE
export async function downloadCategoryPack(category: CategoryKey): Promise<{ ok: boolean; message: string }> {
  const offline = useOfflineStore()
  const res = await offline.fetchAndStore(category)
  return { ok: res.ok, message: res.status }
}

// PUBLIC_INTERFACE
export async function downloadAllCategories(onProgress?: (c: CategoryKey, index: number, total: number, status: string) => void): Promise<{ ok: boolean; summary: string }> {
  const offline = useOfflineStore()
  const cats = offline.categories
  let okAll = true
  for (let i = 0; i < cats.length; i++) {
    const c = cats[i]
    const res = await offline.fetchAndStore(c)
    okAll = okAll && res.ok
    onProgress?.(c, i + 1, cats.length, res.status)
  }
  return { ok: okAll, summary: okAll ? 'All categories downloaded' : 'Some categories failed to download' }
}

// PUBLIC_INTERFACE
export function importPackFromJson(category: CategoryKey, json: string): { ok: boolean; message: string } {
  const offline = useOfflineStore()
  const res = offline.importPack(category, json)
  return { ok: res.ok, message: res.ok ? 'Imported' : (res.error || 'Import failed') }
}

// PUBLIC_INTERFACE
export function exportPackToJson(category: CategoryKey): { ok: boolean; json?: string; message?: string } {
  const offline = useOfflineStore()
  const json = offline.exportPack(category)
  if (!json) return { ok: false, message: 'No pack for category' }
  return { ok: true, json }
}
