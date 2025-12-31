'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import Header from '@/components/Header'
import { getAvatarColor, getInitial } from '@/lib/avatar-colors'

export default function UsersManagementPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/library/auth/login') // 👈 תיקון: הוספת /library
    } else if (session?.user?.role !== 'admin') {
      router.push('/library/dashboard') // 👈 תיקון: הוספת /library
    } else {
      fetchUsers()
    }
  }, [status, session, router])

  const fetchUsers = async () => {
    try {
      const response = await fetch('/api/admin/users') 
      const data = await response.json()
      
      if (response.ok) {
        setUsers(data.users)
      } else {
        setError(data.error)
      }
    } catch {
      setError('שגיאה בטעינת משתמשים')
    } finally {
      setLoading(false)
    }
  }

  const handleRoleChange = async (userId, newRole) => {
    try {
      const response = await fetch('/api/admin/users', { 
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, role: newRole }),
      })

      if (response.ok) {
        fetchUsers()
      } else {
        const data = await response.json()
        alert(data.error)
      }
    } catch {
      alert('שגיאה בעדכון תפקיד')
    }
  }

  const handleDeleteUser = async (userId) => {
    if (!confirm('האם אתה בטוח שברצונך למחוק משתמש זה?')) {
      return
    }

    try {
      const response = await fetch('/api/admin/users', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
      })

      if (response.ok) {
        fetchUsers()
      } else {
        const data = await response.json()
        alert(data.error)
      }
    } catch {
      alert('שגיאה במחיקת משתמש')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <span className="material-symbols-outlined animate-spin text-6xl text-primary">
          progress_activity
        </span>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <div className="container mx-auto px-4 py-12">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-4xl font-bold mb-2 text-on-surface">ניהול משתמשים</h1>
              <p className="text-on-surface/70">נהל הרשאות ומשתמשים במערכת</p>
            </div>
            <div className="glass px-4 py-2 rounded-lg">
              <p className="text-sm text-on-surface/70">סה"כ משתמשים</p>
              <p className="text-3xl font-bold text-primary">{users.length}</p>
            </div>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
              <span className="material-symbols-outlined">error</span>
              <span>{error}</span>
            </div>
          )}

          <div className="glass-strong rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-surface">
                  <tr>
                    <th className="px-6 py-4 text-right text-sm font-medium text-on-surface">שם</th>
                    <th className="px-6 py-4 text-right text-sm font-medium text-on-surface">אימייל</th>
                    <th className="px-6 py-4 text-right text-sm font-medium text-on-surface">תפקיד</th>
                    <th className="px-6 py-4 text-right text-sm font-medium text-on-surface">תאריך הצטרפות</th>
                    <th className="px-6 py-4 text-right text-sm font-medium text-on-surface">פעולות</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-variant">
                  {users.map((user) => (
                    <tr key={user._id} className="hover:bg-surface/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div 
                            className="w-10 h-10 rounded-full text-white flex items-center justify-center font-bold text-lg shadow-md"
                            style={{ backgroundColor: getAvatarColor(user.name) }}
                          >
                            {getInitial(user.name)}
                          </div>
                          <span className="font-medium text-on-surface">{user.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-on-surface/70">{user.email}</td>
                      <td className="px-6 py-4">
                        <select
                          value={user.role}
                          onChange={(e) => handleRoleChange(user._id, e.target.value)}
                          className="px-3 py-1 rounded-lg border border-surface-variant bg-background text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
                          disabled={user._id === session?.user?.id}
                        >
                          <option value="user">משתמש</option>
                          <option value="editor">עורך</option>
                          <option value="admin">מנהל</option>
                        </select>
                      </td>
                      <td className="px-6 py-4 text-on-surface/70">
                        {new Date(user.createdAt).toLocaleDateString('he-IL')}
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => handleDeleteUser(user._id)}
                          disabled={user._id === session?.user?.id}
                          className="text-red-600 hover:text-red-800 disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <span className="material-symbols-outlined">delete</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
