'use client'

import Link, { useLinkStatus } from 'next/link'
import { usePathname } from 'next/navigation'
import { User, Users, Plus, Settings, BarChart2, TrendingUp } from 'lucide-react'

export default function BottomNavClient({ showInvestments }: { showInvestments: boolean }) {
  const pathname = usePathname()
  const tipo = pathname === '/pareja' ? 'pareja' : 'individual'

  const linkClass = (href: string) =>
    `flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-xl px-0 py-1 text-gray-300 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-emerald-400 ${
      pathname === href ? 'text-emerald-300' : 'hover:text-white'
    }`

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-800" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <div className="mx-auto flex h-16 max-w-md items-center justify-around gap-0.5 px-1">
        <Link href="/individual" aria-current={pathname === '/individual' ? 'page' : undefined} className={linkClass('/individual')}>
          <User size={20} />
          <span className="whitespace-nowrap text-[11px] font-semibold">Yo</span><PendingCue />
        </Link>
        <Link href="/pareja" aria-current={pathname === '/pareja' ? 'page' : undefined} className={linkClass('/pareja')}>
          <Users size={20} />
          <span className="whitespace-nowrap text-[11px] font-semibold">Pareja</span><PendingCue />
        </Link>
        <Link href={`/agregar?tipo=${tipo}`} aria-current={pathname === '/agregar' ? 'page' : undefined} className={linkClass('/agregar')}>
          <Plus size={20} />
          <span className="whitespace-nowrap text-[11px] font-semibold">Agregar</span><PendingCue />
        </Link>
        {showInvestments && <Link href="/inversiones" aria-current={pathname === '/inversiones' ? 'page' : undefined} className={linkClass('/inversiones')}>
          <TrendingUp size={20} />
          <span className="whitespace-nowrap text-[10px] font-semibold">Inversiones</span><PendingCue />
        </Link>}
        <Link href="/metricas" aria-current={pathname === '/metricas' ? 'page' : undefined} className={linkClass('/metricas')}>
          <BarChart2 size={20} />
          <span className="whitespace-nowrap text-[11px] font-semibold">Métricas</span><PendingCue />
        </Link>
        <Link href="/config" aria-current={pathname === '/config' ? 'page' : undefined} className={linkClass('/config')}>
          <Settings size={20} />
          <span className="whitespace-nowrap text-[11px] font-semibold">Config</span><PendingCue />
        </Link>
      </div>
    </nav>
  )
}

function PendingCue() {
  const { pending } = useLinkStatus()
  return <>
    <span aria-hidden="true" className={`h-1 w-1 rounded-full ${pending ? 'bg-amber-300' : 'bg-transparent'}`} />
    <span role="status" className="sr-only">{pending ? 'Abriendo pantalla' : ''}</span>
  </>
}
