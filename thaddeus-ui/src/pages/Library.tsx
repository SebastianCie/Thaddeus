import { useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { packagesApi } from '../api/client'
import type { Package } from '../types'
import { format } from 'date-fns'

function formatBytes(bytes: number) {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

function UploadModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [form, setForm] = useState({ packageId: '', version: '' })
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  const uploadMutation = useMutation({
    mutationFn: () => packagesApi.upload(form.packageId, form.version, selectedFile!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['packages'] })
      onClose()
    },
  })

  const canSubmit = form.packageId.trim() && form.version.trim() && selectedFile && !uploadMutation.isPending

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ minWidth: 420 }}>
        <div className="modal-title">Upload Package</div>

        <div className="form-group">
          <label className="form-label">Package ID *</label>
          <input className="form-input" placeholder="e.g. MyWebApp" value={form.packageId}
            onChange={e => setForm(f => ({ ...f, packageId: e.target.value }))} />
          <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
            Logical name of the application (no spaces)
          </span>
        </div>

        <div className="form-group">
          <label className="form-label">Version *</label>
          <input className="form-input" placeholder="e.g. 1.2.3" value={form.version}
            onChange={e => setForm(f => ({ ...f, version: e.target.value }))} />
        </div>

        <div className="form-group">
          <label className="form-label">NuGet Package (.nupkg) *</label>
          <input ref={fileRef} type="file" accept=".nupkg,.zip"
            onChange={e => setSelectedFile(e.target.files?.[0] ?? null)}
            style={{ display: 'none' }} />
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button className="btn btn-secondary" onClick={() => fileRef.current?.click()}>
              Choose file…
            </button>
            <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
              {selectedFile ? `${selectedFile.name} (${formatBytes(selectedFile.size)})` : 'No file selected'}
            </span>
          </div>
        </div>

        {uploadMutation.isError && (
          <p style={{ color: 'var(--color-danger)', fontSize: 13, marginBottom: 8 }}>
            Upload failed. Package ID + version may already exist.
          </p>
        )}

        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={() => uploadMutation.mutate()} disabled={!canSubmit}>
            {uploadMutation.isPending ? 'Uploading…' : 'Upload'}
          </button>
        </div>
      </div>
    </div>
  )
}

export function Library() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [showUpload, setShowUpload] = useState(false)

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
        <button className="btn btn-green" onClick={() => setShowUpload(true)}>+ Upload Package</button>
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
                    <td style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-sm btn-secondary"
                        onClick={() => packagesApi.download(p.packageId, p.version, p.filename)
                          .catch(() => alert('Download failed. Please try again.'))}>
                        ↓ Download
                      </button>
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

      {showUpload && <UploadModal onClose={() => setShowUpload(false)} />}
    </div>
  )
}
