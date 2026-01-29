'use client'

import { useState } from 'react'
import Modal from '@/components/Modal'

export default function ReplacePageBModal({ isOpen, onClose, bookId, onSuccess }) {
  const [replaceType, setReplaceType] = useState('נקודותיים')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState('')

  const handleSubmit = async () => {
    setResult('')
    setLoading(true)
    
    try {
      const response = await fetch('/api/dicta/tools', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tool: 'replace-page-b-headers',
          book_id: bookId,
          replace_type: replaceType
        })
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        setResult(`שגיאה: ${data.detail || 'שגיאה לא ידועה'}`)
        return
      }
      
      setResult(`בוצעו ${data.count} החלפות בהצלחה!`)
      setTimeout(() => {
        onSuccess()
        onClose()
        setResult('')
      }, 1500)
    } catch (error) {
      setResult('שגיאה בתקשורת עם השרת')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setResult('')
    onClose()
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title='החלפת כותרות "עמוד ב"'
      size="md"
    >
      <div className="space-y-4">
        <div className="bg-blue-50 p-4 rounded-lg text-sm text-gray-700">
          <p>כלי זה מחליף כותרות "עמוד ב" בפורמט מותאם.</p>
          <p className="mt-2">דורש הרצה מוקדמת של "יצירת כותרות עמוד ב".</p>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">סוג החלפה</label>
          <select
            value={replaceType}
            onChange={(e) => setReplaceType(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
          >
            <option value="נקודותיים">נקודותיים (:)</option>
            <option value='ע"ב'>ע"ב</option>
          </select>
        </div>

        {result && (
          <div className={`p-3 rounded ${result.includes('שגיאה') ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
            {result}
          </div>
        )}

        <div className="flex gap-3 pt-4">
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="flex-1 bg-primary text-white px-6 py-2.5 rounded-lg hover:bg-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'מעבד...' : 'הפעל'}
          </button>
          <button
            onClick={handleClose}
            className="px-6 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            סגור
          </button>
        </div>
      </div>
    </Modal>
  )
}
