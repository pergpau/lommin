import { useCallback, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Alert from '../components/ui/Alert'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import { AlertTriangleIcon, CheckIcon, FileUpIcon, ShieldIcon, UploadIcon } from '../components/ui/icons'
import { loadEncryptedFile } from '../lib/cryptoFile'
import { importPemKey, saveKey } from '../lib/keystore'
import { importAll, validateImportData } from '../lib/store'

function RestoreForm() {
  const [passphrase, setPassphrase] = useState('')
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [msg, setMsg] = useState('')

  const restore = useCallback(async () => {
    if (!passphrase) {
      setState('error')
      setMsg('Enter the passphrase used when saving the backup.')
      return
    }
    setState('loading')
    setMsg('')
    try {
      const data = validateImportData(await loadEncryptedFile(passphrase))
      await importAll(data)
      const accounts = data.accounts.length
      const txns = data.transactions.length
      setState('done')
      setMsg(`Restored ${accounts} account(s) and ${txns} transaction(s).`)
    } catch (e) {
      if ((e as Error).name === 'AbortError') { setState('idle'); return }
      setState('error')
      setMsg(e instanceof Error ? e.message : 'Failed to restore backup')
    }
  }, [passphrase])

  return (
    <div className="border border-border rounded-xl p-4 animate-fade-in">
      <div className="text-sm font-medium text-text mb-1">Restore from backup</div>
      <p className="text-xs text-muted mb-3">
        Decrypt and merge accounts and transactions from a{' '}
        <span className="mono text-text/70">.enc</span> backup. You still need to import your
        signing key above to fetch new data.
      </p>
      <Input
        label="Passphrase"
        type="password"
        placeholder="Enter backup passphrase…"
        value={passphrase}
        onChange={(e) => setPassphrase(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') restore() }}
        className="mb-3"
      />
      <Button
        className="w-full justify-center"
        loading={state === 'loading'}
        onClick={restore}
      >
        {state !== 'loading' && <UploadIcon size={13} />}
        Choose file &amp; restore
      </Button>
      {msg && <Alert type={state === 'error' ? 'error' : 'ok'} message={msg} className="mt-3" />}
    </div>
  )
}

export default function Setup() {
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [appId, setAppId] = useState('')
  const [error, setError] = useState('')
  const [showRestore, setShowRestore] = useState(false)

  const processFile = useCallback(
    async (file: File) => {
      setState('loading')
      setError('')
      try {
        const pem = await file.text()
        const stem = file.name.replace(/\.pem$/i, '')
        const key = await importPemKey(pem)
        await saveKey(key, stem)
        setAppId(stem)
        setState('done')
        setTimeout(() => navigate('/dashboard'), 1200)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to import key')
        setState('error')
      }
    },
    [navigate],
  )

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragging(false)
      const file = e.dataTransfer.files[0]
      if (file) processFile(file)
    },
    [processFile],
  )

  const onFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) processFile(file)
    },
    [processFile],
  )

  return (
    <div className="min-h-screen bg-bg grid-bg flex items-center justify-center p-4">
      <div className="w-full max-w-md animate-slide-up">
        <div className="mb-8">
          <div className="mono text-accent text-sm mb-3 tracking-widest uppercase">Lommin</div>
          <h1 className="text-2xl font-semibold text-text tracking-tight leading-tight">
            Import your signing key
          </h1>
          <p className="text-muted text-sm mt-2">
            Drop your Enable Banking <span className="mono text-text/70">.pem</span> private key. It never
            leaves your device.
          </p>
        </div>

        {state !== 'done' && (
          <div
            className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all duration-200 ${dragging
                ? 'border-accent bg-accent/5'
                : 'border-border hover:border-border-2 hover:bg-surface/50'
              }`}
            onDragEnter={(e) => { e.preventDefault(); setDragging(true) }}
            onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => inputRef.current?.click()}
          >
            <input ref={inputRef} type="file" accept=".pem" className="hidden" onChange={onFileChange} />
            {state === 'loading' ? (
              <div className="flex flex-col items-center gap-3">
                <div className="animate-spin w-6 h-6 border-2 border-accent/20 border-t-accent rounded-full" />
                <span className="text-muted text-sm">Importing key…</span>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-surface border border-border flex items-center justify-center">
                  <FileUpIcon size={20} className="text-muted" />
                </div>
                <div>
                  <div className="text-sm text-text font-medium">
                    {dragging ? 'Drop to import' : 'Drop .pem file here'}
                  </div>
                  <div className="text-xs text-muted mt-0.5">or click to browse</div>
                </div>
              </div>
            )}
          </div>
        )}

        {state === 'done' && (
          <div className="border border-positive/20 bg-positive/5 rounded-xl p-6 animate-fade-in">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-positive/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                <CheckIcon size={16} className="text-positive" />
              </div>
              <div>
                <div className="text-sm font-medium text-text">Key imported</div>
                <div className="mono text-xs text-muted mt-1 break-all">{appId}</div>
                <div className="text-xs text-muted mt-2">Redirecting to dashboard…</div>
              </div>
            </div>
          </div>
        )}

        {state === 'error' && <Alert type="error" message={error} className="mt-4" />}

        <div className="mt-4">
          {!showRestore ? (
            <button
              className="text-xs text-muted hover:text-text transition-colors"
              onClick={() => setShowRestore(true)}
            >
              Have an encrypted backup? <span className="text-accent">Restore from file</span>
            </button>
          ) : (
            <RestoreForm />
          )}
        </div>

        <div className="mt-8 pt-6 border-t border-border space-y-3">
          <div className="flex items-start gap-2">
            <ShieldIcon size={14} className="text-muted flex-shrink-0 mt-0.5" />
            <p className="text-xs text-muted leading-relaxed">
              Your key is stored as a non-extractable{' '}
              <span className="mono">CryptoKey</span> in IndexedDB. Raw bytes are{' '}
              never recoverable by JavaScript after import.
            </p>
          </div>
          <div className="flex items-start gap-2">
            <AlertTriangleIcon size={14} className="text-muted flex-shrink-0 mt-0.5" />
            <p className="text-xs text-muted leading-relaxed">
              <span className="text-text/80">Heads up:</span> bank API calls are relayed
              through a hosted proxy, which can see your transaction data and short-lived
              access token in transit (it never receives your key). For full privacy, point{' '}
              <span className="mono">Settings → CORS Proxy</span> at your own server.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
