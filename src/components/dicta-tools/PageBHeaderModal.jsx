'use client'

import { useState } from 'react'
import Modal from '@/components/Modal'
import FormInput from '@/components/FormInput'

export default function PageBHeaderModal({ isOpen, onClose, bookId, onSuccess }) {
  const [headerLevel, setHeaderLevel] = useState(2)
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
          tool: 'create-page-b-headers',
          book_id: bookId,
          header_level: headerLevel
        })
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        setResult(`שגיאה: ${data.detail || 'שגיאה לא ידועה'}`)
        return
      }
      
      setResult(`נוצרו ${data.count} כותרות "עמוד ב" בהצלחה!`)
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
      title='יצירת כותרות "עמוד ב"'
      size="md"
    >
      <div className="space-y-4">
        <div className="bg-blue-50 p-4 rounded-lg text-sm text-gray-700">
          <p>כלי זה מזהה אזכורים של "עמוד ב" / "ע"ב" בטקסט ויוצר מהם כותרות.</p>
          <p className="mt-2">שימושי במיוחד בספרי תלמוד ופרשנות.</p>
        </div>

        <FormInput
          label="רמת כותרת"
          type="number"
          value={headerLevel}
          onChange={(e) => setHeaderLevel(parseInt(e.target.value) || 2)}
          placeholder="2-6"
        />

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
