import { useState } from 'react'
import { Link } from 'react-router-dom'

interface QueryResult {
  success: boolean
  type: 'select' | 'execute' | 'error'
  columns?: string[]
  rows?: Record<string, unknown>[]
  row_count?: number
  affected_rows?: number
  message?: string
}

const EXAMPLE_QUERIES = [
  {
    label: 'Mostra tabelle',
    query: `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;`
  },
  {
    label: 'Conta righe per tabella',
    query: `SELECT 'users' as table_name, COUNT(*) as count FROM users
UNION ALL SELECT 'houses', COUNT(*) FROM houses
UNION ALL SELECT 'shopping_lists', COUNT(*) FROM shopping_lists
UNION ALL SELECT 'shopping_list_items', COUNT(*) FROM shopping_list_items
UNION ALL SELECT 'categories', COUNT(*) FROM categories;`
  },
  {
    label: 'Shopping lists attive',
    query: `SELECT id, name, status, created_at FROM shopping_lists WHERE status = 'active' ORDER BY created_at DESC;`
  },
  {
    label: 'Struttura shopping_list_items',
    query: `SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'shopping_list_items' ORDER BY ordinal_position;`
  },
  {
    label: 'Crea tabella categories',
    query: `CREATE TABLE IF NOT EXISTS categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    description VARCHAR(500),
    icon VARCHAR(50),
    color VARCHAR(7),
    sort_order INTEGER DEFAULT 0 NOT NULL,
    created_by UUID,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);`
  },
  {
    label: 'Aggiungi colonne mancanti',
    query: `ALTER TABLE shopping_list_items ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES categories(id) ON DELETE SET NULL;
ALTER TABLE shopping_list_items ADD COLUMN IF NOT EXISTS expiry_date DATE;`
  },
]

export function SqlConsole() {
  const token = localStorage.getItem('access_token')
  const [query, setQuery] = useState('')
  const [isExecuting, setIsExecuting] = useState(false)
  const [result, setResult] = useState<QueryResult | null>(null)
  const [history, setHistory] = useState<string[]>([])

  const executeQuery = async () => {
    if (!query.trim()) return

    setIsExecuting(true)
    setResult(null)

    try {
      const response = await fetch('/api/v1/admin/sql-console', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: query.trim() }),
      })

      const data = await response.json()
      setResult(data)

      // Add to history if successful
      if (data.success && !history.includes(query.trim())) {
        setHistory(prev => [query.trim(), ...prev.slice(0, 9)])
      }
    } catch (err) {
      setResult({
        success: false,
        type: 'error',
        message: err instanceof Error ? err.message : 'Errore di connessione'
      })
    } finally {
      setIsExecuting(false)
    }
  }

  const loadExample = (exampleQuery: string) => {
    setQuery(exampleQuery)
    setResult(null)
  }

  return (
    <div className="space-y-4 pb-20">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Link to="/settings" className="text-gray-500 hover:text-gray-700">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">SQL Console</h1>
          <p className="text-gray-600 text-sm mt-1">
            Esegui query SQL direttamente sul database
          </p>
        </div>
      </div>

      {/* Warning */}
      <div className="bg-red-50 border border-red-200 rounded-lg p-3">
        <div className="flex gap-2">
          <span className="text-red-600">⚠️</span>
          <div className="text-sm text-red-800">
            <p className="font-medium">Attenzione</p>
            <p>Le query vengono eseguite direttamente sul database. Usa con cautela!</p>
          </div>
        </div>
      </div>

      {/* Example queries */}
      <div className="card p-4">
        <p className="text-sm font-medium text-gray-700 mb-2">Query di esempio:</p>
        <div className="flex flex-wrap gap-2">
          {EXAMPLE_QUERIES.map((example, i) => (
            <button
              key={i}
              onClick={() => loadExample(example.query)}
              className="px-3 py-1.5 text-xs bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              {example.label}
            </button>
          ))}
        </div>
      </div>

      {/* Query input */}
      <div className="card p-4 space-y-3">
        <textarea
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="SELECT * FROM users LIMIT 10;"
          className="w-full h-40 p-3 font-mono text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-y"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
              e.preventDefault()
              executeQuery()
            }
          }}
        />
        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-500">Ctrl+Enter per eseguire</p>
          <button
            onClick={executeQuery}
            disabled={!query.trim() || isExecuting}
            className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isExecuting ? (
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Esecuzione...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Esegui
              </>
            )}
          </button>
        </div>
      </div>

      {/* Results */}
      {result && (
        <div className="card p-4">
          {result.success ? (
            result.type === 'select' ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-green-700">
                    ✅ {result.row_count} righe trovate
                  </p>
                </div>
                {result.rows && result.rows.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="bg-gray-100">
                          {result.columns?.map((col, i) => (
                            <th key={i} className="px-3 py-2 text-left font-medium text-gray-700 border-b">
                              {col}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {result.rows.map((row, i) => (
                          <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                            {result.columns?.map((col, j) => (
                              <td key={j} className="px-3 py-2 border-b border-gray-200 font-mono text-xs">
                                {row[col] === null ? (
                                  <span className="text-gray-400 italic">NULL</span>
                                ) : typeof row[col] === 'object' ? (
                                  JSON.stringify(row[col])
                                ) : (
                                  String(row[col])
                                )}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-gray-500 text-sm">Nessun risultato</p>
                )}
              </div>
            ) : (
              <div className="text-green-700">
                <p className="font-medium">✅ {result.message}</p>
                {result.affected_rows !== undefined && result.affected_rows > 0 && (
                  <p className="text-sm mt-1">{result.affected_rows} righe modificate</p>
                )}
              </div>
            )
          ) : (
            <div className="text-red-700">
              <p className="font-medium">❌ Errore</p>
              <pre className="mt-2 p-3 bg-red-50 rounded text-xs overflow-x-auto whitespace-pre-wrap">
                {result.message}
              </pre>
            </div>
          )}
        </div>
      )}

      {/* History */}
      {history.length > 0 && (
        <div className="card p-4">
          <p className="text-sm font-medium text-gray-700 mb-2">Cronologia:</p>
          <div className="space-y-2">
            {history.map((q, i) => (
              <button
                key={i}
                onClick={() => loadExample(q)}
                className="w-full text-left p-2 text-xs font-mono bg-gray-50 hover:bg-gray-100 rounded truncate"
              >
                {q.substring(0, 100)}{q.length > 100 ? '...' : ''}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default SqlConsole
