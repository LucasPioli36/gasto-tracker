'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { User, Users, Plus, Settings, BarChart2, TrendingUp } from 'lucide-react'

export default function BottomNavClient({ showInvestments }: { showInvestments: boolean }) {
  const pathname = usePathname()
  const tipo = pathname === '/pareja' ? 'pareja' : 'individual'

  const linkClass = (href: string) =>
    `${showInvestments ? 'min-w-0 flex flex-1 px-0' : 'flex px-4'} flex-col items-center gap-1 py-2 rounded-xl transition-colors ${
      pathname === href ? 'text-emerald-400' : 'text-gray-500 hover:text-gray-300'
    }`

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-800" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <div className={`flex justify-around items-center h-16 max-w-md mx-auto ${showInvestments ? 'px-1' : 'px-2'}`}>
        <Link href="/individual" className={linkClass('/individual')}>
          <User size={20} />
          <span className={showInvestments ? 'whitespace-nowrap text-[9px] font-medium' : 'text-xs font-medium'}>Yo</span>
        </Link>
        <Link href="/pareja" className={linkClass('/pareja')}>
          <Users size={20} />
          <span className={showInvestments ? 'whitespace-nowrap text-[9px] font-medium' : 'text-xs font-medium'}>Pareja</span>
        </Link>
        <Link href={`/agregar?tipo=${tipo}`} className={linkClass('/agregar')}>
          <Plus size={20} />
          <span className={showInvestments ? 'whitespace-nowrap text-[9px] font-medium' : 'text-xs font-medium'}>Agregar</span>
        </Link>
        {showInvestments && <Link href="/inversiones" className={linkClass('/inversiones')}>
          <TrendingUp size={20} />
          <span className="whitespace-nowrap text-[9px] font-medium">Inversiones</span>
        </Link>}
        <Link href="/metricas" className={linkClass('/metricas')}>
          <BarChart2 size={20} />
          <span className={showInvestments ? 'whitespace-nowrap text-[9px] font-medium' : 'text-xs font-medium'}>Métricas</span>
        </Link>
        <Link href="/config" className={linkClass('/config')}>
          <Settings size={20} />
          <span className={showInvestments ? 'whitespace-nowrap text-[9px] font-medium' : 'text-xs font-medium'}>Config</span>
        </Link>
      </div>
    </nav>
  )
}
