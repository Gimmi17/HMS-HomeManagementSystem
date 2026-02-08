import { useNavigate } from 'react-router-dom'

interface AnagraficaItem {
  id: string
  label: string
  description: string
  icon: string
  path: string
  color: string
  implemented: boolean
}

const anagrafiche: AnagraficaItem[] = [
  {
    id: 'users',
    label: 'Utenti',
    description: 'Gestione profili utente: crea, modifica, banna o elimina',
    icon: '👤',
    path: '/anagrafiche/users',
    color: 'bg-blue-500',
    implemented: true,
  },
  {
    id: 'categories',
    label: 'Categorie',
    description: 'Categorie per organizzare prodotti e articoli',
    icon: '🏷️',
    path: '/settings/categories',
    color: 'bg-purple-500',
    implemented: true,
  },
  {
    id: 'stores',
    label: 'Negozi',
    description: 'Punti vendita e supermercati',
    icon: '🏪',
    path: '/settings/stores',
    color: 'bg-orange-500',
    implemented: true,
  },
  {
    id: 'foods',
    label: 'Alimenti',
    description: 'Database nutrizionale con valori per 100g',
    icon: '🥗',
    path: '/anagrafiche/foods',
    color: 'bg-emerald-500',
    implemented: true,
  },
  {
    id: 'products',
    label: 'Catalogo Prodotti',
    description: 'Prodotti con barcode, prezzi e informazioni',
    icon: '📦',
    path: '/anagrafiche/products',
    color: 'bg-amber-500',
    implemented: true,
  },
  {
    id: 'recipes',
    label: 'Ricette',
    description: 'Ricette salvate con ingredienti e procedimenti',
    icon: '📖',
    path: '/recipes',
    color: 'bg-rose-500',
    implemented: true,
  },
]

export function Anagrafiche() {
  const navigate = useNavigate()

  const handleClick = (item: AnagraficaItem) => {
    if (item.implemented) {
      navigate(item.path)
    }
  }

  return (
    <div className="space-y-4 pb-20">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Anagrafiche</h1>
      </div>

      <p className="text-sm text-gray-500">
        Gestione dati di base del sistema. Seleziona un'anagrafica per visualizzare e modificare i dati.
      </p>

      {/* Grid of anagrafiche */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {anagrafiche.map((item) => (
          <button
            key={item.id}
            onClick={() => handleClick(item)}
            disabled={!item.implemented}
            className={`card p-4 text-left transition-all ${
              item.implemented
                ? 'hover:shadow-md hover:border-gray-200 cursor-pointer'
                : 'opacity-60 cursor-not-allowed'
            }`}
          >
            <div className="flex items-start gap-3">
              <span
                className={`w-12 h-12 rounded-xl ${item.color} flex items-center justify-center text-2xl flex-shrink-0`}
              >
                {item.icon}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-gray-900">{item.label}</h3>
                  {!item.implemented && (
                    <span className="px-1.5 py-0.5 text-xs rounded bg-gray-100 text-gray-500">
                      Coming soon
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-500 mt-0.5 line-clamp-2">
                  {item.description}
                </p>
              </div>
              {item.implemented && (
                <svg
                  className="w-5 h-5 text-gray-400 flex-shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              )}
            </div>
          </button>
        ))}
      </div>

      {/* Info box */}
      <div className="card bg-blue-50 border-blue-100 p-4">
        <div className="flex gap-3">
          <span className="text-blue-500 text-xl">ℹ️</span>
          <div>
            <p className="text-sm text-blue-800 font-medium">
              Anagrafiche disponibili: {anagrafiche.filter(a => a.implemented).length}/{anagrafiche.length}
            </p>
            <p className="text-xs text-blue-600 mt-1">
              Le voci "Coming soon" saranno implementate nelle prossime versioni.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Anagrafiche
