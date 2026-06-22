import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { packagesApi } from '../api/client'
import type { Package } from '../types'
import { format } from 'date-fns'

function formatBytes(bytes: number) {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

export function Library() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)

  const { data: packages = [], isLoading } = useQuery<Package[]>({
    queryKey: ['packages', search, page],
    queryFn: () => packagesApi.list(search || undefined, page, 20),
  })

  const deleteMutation = useMutation({
    mutationFn: ({ packageId, version }: { packageId: string; version: string }) =>
      packagesApi.delete(packageId, version),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['packages'] }),
  })

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Library — Packages</h1>
      </div>

      <div style={{ marginBottom: 16 }}>
        <input className="form-input" placeholder="Search packages…" value={search}
          onChange={e => { setSearch(e.target.value); setPage(0) }}
          style={{ maxWidth: 320 }} />
      </div>

      {isLoading ? <div className="loading">Loading…</div> : (
        <div className="card" style={{ padding: 0 }}>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Package ID</th><th>Version</th><th>Size</th><th>SHA256</th><th>Uploaded</th><th></th></tr></thead>
              <tbody>
                {packages.length === 0 ? (
                  <tr><td colSpan={6}><div className="empty-state">No packages found.</div></td></tr>
                ) : packages.map(p => (
                  <tr key={p.id}>
                    <td style={{ fontFamily: 'monospace', fontWeight: 500 }}>{p.packageId}</td>
                    <td style={{ fontFamily: 'monospace' }}>{p.version}</td>
                    <td style={{ fontSize: 12 }}>{formatBytes(p.sizeBytes)}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--color-text-muted)' }}>
                      {p.sha256.slice(0, 12)}…
                    </td>
                    <td style={{ fontSize: 12 }}>{format(new Date(p.uploadedAt), 'yyyy-MM-dd HH:mm')}</td>
                    <td>
                      <button className="btn btn-sm btn-danger"
                        onClick={() => { if (confirm(`Delete ${p.packageId} ${p.version}?`))
                          deleteMutation.mutate({ packageId: p.packageId, version: p.version }) }}>
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ display: 'flex', gap: 8, padding: 12, borderTop: '1px solid var(--color-border)' }}>
            <button className="btn btn-secondary btn-sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>← Prev</button>
            <span style={{ lineHeight: '28px', color: 'var(--color-text-muted)', fontSize: 12 }}>Page {page + 1}</span>
            <button className="btn btn-secondary btn-sm" disabled={packages.length < 20} onClick={() => setPage(p => p + 1)}>Next →</button>
          </div>
        </div>
      )}
    </div>
  )
}
