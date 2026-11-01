export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="max-w-md mx-auto px-4 pt-6 pb-28">{children}</main>
  )
}
