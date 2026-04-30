/**
 * UserProfileSettings — Dati Anagrafici
 * Visualizzazione + modifica profilo anagrafico utente.
 */

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import anagraficaService, { UserAnagrafica, UserAnagraficaUpdate } from '@/services/anagrafica'

// ─── Codice Fiscale Parser ────────────────────────────────────────────────────
const CF_MONTH_MAP: Record<string, number> = {
  A: 1, B: 2, C: 3, D: 4, E: 5, H: 6,
  L: 7, M: 8, P: 9, R: 10, S: 11, T: 12,
}

function parseCF(cf: string): { birth_date?: string; gender?: string } {
  if (!cf || cf.length !== 16) return {}
  cf = cf.toUpperCase()
  try {
    const yearSuffix = parseInt(cf.slice(6, 8), 10)
    const year = yearSuffix <= new Date().getFullYear() % 100 ? 2000 + yearSuffix : 1900 + yearSuffix
    const monthChar = cf[8]
    const month = CF_MONTH_MAP[monthChar]
    if (!month) return {}
    const rawDay = parseInt(cf.slice(9, 11), 10)
    const gender = rawDay > 40 ? 'F' : 'M'
    const day = rawDay > 40 ? rawDay - 40 : rawDay
    const birth_date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    return { birth_date, gender }
  } catch {
    return {}
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', '0+', '0-']

function formatDate(iso?: string): string {
  if (!iso) return '—'
  try {
    const d = new Date(iso + 'T00:00:00')
    return d.toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' })
  } catch { return iso }
}

function avatar(data: UserAnagrafica): string {
  if (data.first_name) return data.first_name.charAt(0).toUpperCase()
  if (data.full_name)  return data.full_name.charAt(0).toUpperCase()
  return '?'
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt className="text-xs font-medium text-gray-400 uppercase tracking-wide">{label}</dt>
      <dd className="mt-0.5 text-sm text-gray-900 font-medium">{value || '—'}</dd>
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 pt-1">
      {children}
    </h3>
  )
}

// ─── Tag Input per allergie ───────────────────────────────────────────────────
function TagInput({
  tags, onChange
}: { tags: string[]; onChange: (tags: string[]) => void }) {
  const [input, setInput] = useState('')

  const add = () => {
    const v = input.trim()
    if (v && !tags.includes(v)) onChange([...tags, v])
    setInput('')
  }

  return (
    <div>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {tags.map(tag => (
          <span key={tag} className="inline-flex items-center gap-1 bg-red-50 text-red-700 border border-red-200 text-xs px-2 py-0.5 rounded-full">
            {tag}
            <button type="button" onClick={() => onChange(tags.filter(t => t !== tag))} className="text-red-400 hover:text-red-600 leading-none">×</button>
          </span>
        ))}
        {tags.length === 0 && <span className="text-xs text-gray-400">Nessuna allergia registrata</span>}
      </div>
      <div className="flex gap-2">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add() } }}
          placeholder="es. Penicillina, Lattosio…"
          className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
        />
        <button type="button" onClick={add}
          className="text-sm text-blue-600 border border-blue-200 px-3 py-2 rounded-lg hover:bg-blue-50">
          + Aggiungi
        </button>
      </div>
    </div>
  )
}

// ─── Form input helpers ───────────────────────────────────────────────────────
function FormInput({
  label, value, onChange, type = 'text', placeholder, hint, readOnly
}: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; placeholder?: string; hint?: string; readOnly?: boolean
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        readOnly={readOnly}
        className={`w-full text-sm border rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500
          ${readOnly ? 'bg-gray-50 text-gray-400 cursor-default' : 'bg-white border-gray-200'}`}
      />
      {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
    </div>
  )
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────
export function UserProfileSettings() {
  const [data, setData]       = useState<UserAnagrafica | null>(null)
  const [form, setForm]       = useState<UserAnagraficaUpdate>({})
  const [editing, setEditing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    anagraficaService.get()
      .then(d => { setData(d); resetForm(d) })
      .catch(() => setError('Impossibile caricare il profilo'))
      .finally(() => setLoading(false))
  }, [])

  function resetForm(d: UserAnagrafica) {
    setForm({
      first_name:              d.first_name              || '',
      last_name:               d.last_name               || '',
      codice_fiscale:          d.codice_fiscale           || '',
      birth_date:              d.birth_date               || '',
      birth_place:             d.birth_place              || '',
      gender:                  d.gender                   || '',
      height_cm:               d.height_cm,
      phone:                   d.phone                    || '',
      address:                 d.address                  || '',
      blood_type:              d.blood_type               || '',
      allergies_medical:       d.allergies_medical        || [],
      emergency_contact_name:  d.emergency_contact_name   || '',
      emergency_contact_phone: d.emergency_contact_phone  || '',
      notes:                   d.notes                    || '',
    })
  }

  function set(field: keyof UserAnagraficaUpdate, value: unknown) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  function handleCF(cf: string) {
    set('codice_fiscale', cf)
    if (cf.length === 16) {
      const parsed = parseCF(cf)
      if (parsed.birth_date) set('birth_date', parsed.birth_date)
      if (parsed.gender)     set('gender', parsed.gender)
    }
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      const updated = await anagraficaService.update(form)
      setData(updated)
      resetForm(updated)
      setEditing(false)
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch {
      setError('Errore durante il salvataggio')
    } finally {
      setSaving(false)
    }
  }

  function handleCancel() {
    if (data) resetForm(data)
    setEditing(false)
    setError(null)
  }

  if (loading) return (
    <div className="flex items-center justify-center py-12">
      <div className="text-gray-400 text-sm">Caricamento…</div>
    </div>
  )

  return (
    <div className="space-y-4 max-w-lg mx-auto pb-8">

      {/* Header */}
      <div className="flex items-center gap-3">
        <Link to="/settings" className="text-gray-400 hover:text-gray-600 p-1 -ml-1">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-900">Profilo & Anagrafica</h1>
          <p className="text-gray-500 text-sm">Dati personali e anagrafici</p>
        </div>
        {!editing && (
          <button onClick={() => setEditing(true)}
            className="text-sm text-blue-600 font-semibold border border-blue-200 px-4 py-2 rounded-xl hover:bg-blue-50 transition-colors">
            Modifica
          </button>
        )}
      </div>

      {/* Feedback */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">{error}</div>
      )}
      {success && (
        <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm text-green-700">
          ✅ Profilo aggiornato con successo
        </div>
      )}

      {/* Avatar + nome */}
      <div className="card p-4 flex items-center gap-4">
        <div className="w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold text-white flex-shrink-0"
          style={{ background: 'linear-gradient(135deg, #4299e1, #805ad5)' }}>
          {data ? avatar(data) : '?'}
        </div>
        <div>
          <div className="font-bold text-gray-900 text-base">
            {data?.first_name || data?.full_name || '—'} {data?.last_name || ''}
          </div>
          <div className="text-sm text-gray-500">{data?.email}</div>
          {data?.codice_fiscale && (
            <div className="text-xs font-mono text-gray-400 mt-0.5 tracking-wider">{data.codice_fiscale}</div>
          )}
        </div>
      </div>

      {/* ═══ VISUALIZZAZIONE ═══ */}
      {!editing && data && (
        <>
          {/* Dati personali */}
          <div className="card p-4 space-y-4">
            <SectionTitle>👤 Dati Personali</SectionTitle>
            <dl className="grid grid-cols-2 gap-4">
              <Field label="Nome"      value={data.first_name} />
              <Field label="Cognome"   value={data.last_name} />
              <Field label="Nascita"   value={formatDate(data.birth_date)} />
              <Field label="Sesso"     value={data.gender === 'M' ? 'Maschio' : data.gender === 'F' ? 'Femmina' : undefined} />
              <div className="col-span-2">
                <Field label="Luogo di nascita" value={data.birth_place} />
              </div>
              <div className="col-span-2">
                <Field label="Codice Fiscale" value={data.codice_fiscale} />
              </div>
            </dl>
          </div>

          {/* Contatti */}
          <div className="card p-4 space-y-4">
            <SectionTitle>📞 Contatti</SectionTitle>
            <dl className="grid grid-cols-2 gap-4">
              <Field label="Telefono" value={data.phone} />
              <div className="col-span-2"><Field label="Indirizzo" value={data.address} /></div>
            </dl>
          </div>

          {/* Salute */}
          <div className="card p-4 space-y-4">
            <SectionTitle>🩺 Salute</SectionTitle>
            <dl className="grid grid-cols-2 gap-4">
              <Field label="Altezza"        value={data.height_cm ? `${data.height_cm} cm` : undefined} />
              <Field label="Gruppo sanguigno" value={data.blood_type} />
            </dl>
            <div>
              <dt className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Allergie mediche</dt>
              <dd className="flex flex-wrap gap-1.5">
                {(data.allergies_medical || []).length > 0
                  ? data.allergies_medical.map(a => (
                    <span key={a} className="bg-red-50 text-red-700 border border-red-200 text-xs px-2.5 py-1 rounded-full">{a}</span>
                  ))
                  : <span className="text-sm text-gray-400">Nessuna allergia registrata</span>
                }
              </dd>
            </div>
          </div>

          {/* Emergenza */}
          <div className="card p-4 space-y-4">
            <SectionTitle>🆘 Contatto di Emergenza</SectionTitle>
            <dl className="grid grid-cols-2 gap-4">
              <div className="col-span-2"><Field label="Nome" value={data.emergency_contact_name} /></div>
              <Field label="Telefono" value={data.emergency_contact_phone} />
            </dl>
          </div>

          {/* Note */}
          {data.notes && (
            <div className="card p-4">
              <SectionTitle>📝 Note</SectionTitle>
              <p className="text-sm text-gray-700 whitespace-pre-line">{data.notes}</p>
            </div>
          )}
        </>
      )}

      {/* ═══ FORM MODIFICA ═══ */}
      {editing && (
        <form onSubmit={e => { e.preventDefault(); handleSave() }} className="space-y-4">

          {/* Dati personali */}
          <div className="card p-4 space-y-4">
            <SectionTitle>👤 Dati Personali</SectionTitle>
            <div className="grid grid-cols-2 gap-3">
              <FormInput label="Nome"    value={form.first_name || ''} onChange={v => set('first_name', v)} placeholder="Mario" />
              <FormInput label="Cognome" value={form.last_name  || ''} onChange={v => set('last_name', v)}  placeholder="Rossi" />
            </div>
            <FormInput
              label="Codice Fiscale"
              value={(form.codice_fiscale || '').toUpperCase()}
              onChange={handleCF}
              placeholder="RSSMRA98P17B563D"
              hint="La data di nascita e il sesso vengono compilati automaticamente"
            />
            <div className="grid grid-cols-2 gap-3">
              <FormInput
                label="Data di nascita"
                type="date"
                value={form.birth_date || ''}
                onChange={v => set('birth_date', v)}
                hint="Auto da CF"
              />
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Sesso</label>
                <select
                  value={form.gender || ''}
                  onChange={e => set('gender', e.target.value)}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="">—</option>
                  <option value="M">Maschio</option>
                  <option value="F">Femmina</option>
                </select>
              </div>
            </div>
            <FormInput
              label="Luogo di nascita"
              value={form.birth_place || ''}
              onChange={v => set('birth_place', v)}
              placeholder="Milano (MI)"
            />
          </div>

          {/* Contatti */}
          <div className="card p-4 space-y-4">
            <SectionTitle>📞 Contatti</SectionTitle>
            <FormInput label="Telefono" type="tel" value={form.phone || ''} onChange={v => set('phone', v)} placeholder="+39 333 1234567" />
            <FormInput label="Indirizzo" value={form.address || ''} onChange={v => set('address', v)} placeholder="Via Roma 1, 20100 Milano" />
          </div>

          {/* Salute */}
          <div className="card p-4 space-y-4">
            <SectionTitle>🩺 Salute</SectionTitle>
            <div className="grid grid-cols-2 gap-3">
              <FormInput
                label="Altezza (cm)"
                type="number"
                value={form.height_cm !== undefined ? String(form.height_cm) : ''}
                onChange={v => set('height_cm', v ? parseFloat(v) : undefined)}
                placeholder="175"
              />
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Gruppo sanguigno</label>
                <select
                  value={form.blood_type || ''}
                  onChange={e => set('blood_type', e.target.value)}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="">—</option>
                  {BLOOD_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Allergie mediche</label>
              <TagInput tags={form.allergies_medical || []} onChange={v => set('allergies_medical', v)} />
            </div>
          </div>

          {/* Emergenza */}
          <div className="card p-4 space-y-4">
            <SectionTitle>🆘 Contatto di Emergenza</SectionTitle>
            <FormInput label="Nome" value={form.emergency_contact_name || ''} onChange={v => set('emergency_contact_name', v)} placeholder="Anna Rossi" />
            <FormInput label="Telefono" type="tel" value={form.emergency_contact_phone || ''} onChange={v => set('emergency_contact_phone', v)} placeholder="+39 333 9876543" />
          </div>

          {/* Note */}
          <div className="card p-4 space-y-3">
            <SectionTitle>📝 Note</SectionTitle>
            <textarea
              value={form.notes || ''}
              onChange={e => set('notes', e.target.value)}
              placeholder="Informazioni aggiuntive rilevanti per la salute…"
              rows={3}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none bg-white"
            />
          </div>

          {/* Azioni */}
          <div className="flex gap-3">
            <button type="button" onClick={handleCancel}
              className="flex-1 py-3.5 rounded-xl border border-gray-200 text-gray-600 font-semibold text-sm hover:bg-gray-50">
              Annulla
            </button>
            <button type="submit" disabled={saving}
              className="flex-2 flex-grow-[2] py-3.5 rounded-xl bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700 disabled:opacity-50 transition-colors">
              {saving ? 'Salvataggio…' : '✓ Salva modifiche'}
            </button>
          </div>
        </form>
      )}

    </div>
  )
}

export default UserProfileSettings
