'use client'

import { useState } from 'react'
import Modal from '@/components/Modal'

export default function PunctuateModal({ isOpen, onClose, bookId, onSuccess }) {
  const [addEnding, setAddEnding] = useState('הוסף נקודה')
  const [emphasizeStart, setEmphasizeStart] = useState(true)
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
          tool: 'emphasize-and-punctuate',
          book_id: bookId,
          add_ending: addEnding,
          emphasize_start: emphasizeStart
        })
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        setResult(`שגיאה: ${data.detail || 'שגיאה לא ידועה'}`)
        return
      }
      
      if (data.changed) {
        setResult('השינויים בוצעו בהצלחה!')
        setTimeout(() => {
          onSuccess()
          onClose()
          setResult('')
        }, 1500)
      } else {
        setResult('לא בוצעו שינויים')
      }
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
      title="הדגשה וניקוד"
      size="md"
    >
      <div className="space-y-4">
        <div className="bg-blue-50 p-4 rounded-lg text-sm text-gray-700">
          <p>כלי זה מוסיף נקודה או נקודותיים בסוף שורות ארוכות ומדגיש את המילה הראשונה.</p>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">הוספת סימן בסוף</label>
          <select
            value={addEnding}
            onChange={(e) => setAddEnding(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
          >
            <option value="הוסף נקודה">הוסף נקודה</option>
            <option value="הוסף נקודותיים">הוסף נקודותיים</option>
            <option value="ללא שינוי">ללא שינוי</option>
          </select>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={emphasizeStart}
            onChange={(e) => setEmphasizeStart(e.target.checked)}
            className="w-4 h-4"
          />
          <span>הדגש את המילה הראשונה בשורה</span>
        </label>

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
