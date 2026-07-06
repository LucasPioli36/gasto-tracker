import BottomNav from '@/components/BottomNav'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-950">
      <main className="max-w-md mx-auto px-4 pt-6 pb-24">{children}</main>
      <BottomNav />
    </div>
  )
}
