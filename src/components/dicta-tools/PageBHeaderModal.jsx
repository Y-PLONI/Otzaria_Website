'use client'

import { useState } from 'react'
import Modal from '@/components/Modal'
import FormInput from '@/components/FormInput'

export default function PageBHeaderModal({ isOpen, onClose, content, onContentChange }) {
  const [headerLevel, setHeaderLevel] = useState(2)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState('')

  const handleSubmit = () => {
    setResult('')
    setLoading(true)
    
    try {
      let newContent = content
      let count = 0
      
      // חיפוש דפוסים של "עמוד ב" או "ע"ב"
      const patterns = [
        /עמוד ב(?![א-ת])/g,
        /ע"ב(?![א-ת])/g,
        /ע״ב(?![א-ת])/g
      ]
      
      patterns.forEach(pattern => {
        const matches = newContent.match(pattern)
        if (matches) {
          count += matches.length
          newContent = newContent.replace(pattern, (match) => `<h${headerLevel}>${match}</h${headerLevel}>`)
        }
      })
      
      if (count > 0) {
        setResult(`נוצרו ${count} כותרות "עמוד ב" בהצלחה!`)
        onContentChange(newContent)
        setTimeout(() => {
          onClose()
          setResult('')
        }, 1500)
      } else {
        setResult('לא נמצאו אזכורים של "עמוד ב"')
      }
    } catch (error) {
      setResult('שגיאה בביצוע הפעולה')
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
