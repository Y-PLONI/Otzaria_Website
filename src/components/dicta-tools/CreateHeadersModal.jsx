'use client'

import { useState } from 'react'
import Modal from '@/components/Modal'
import FormInput from '@/components/FormInput'

export default function CreateHeadersModal({ isOpen, onClose, bookId, onSuccess }) {
  const [findWord, setFindWord] = useState('דף')
  const [endNumber, setEndNumber] = useState(999)
  const [level, setLevel] = useState(2)
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
          tool: 'create-headers',
          book_id: bookId,
          find_word: findWord,
          end: endNumber,
          level_num: level
        })
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        setResult(`שגיאה: ${data.detail || 'שגיאה לא ידועה'}`)
        return
      }
      
      if (data.found) {
        setResult(`נוצרו ${data.count} כותרות בהצלחה!`)
        setTimeout(() => {
          onSuccess()
          onClose()
          setResult('')
        }, 1500)
      } else {
        setResult('לא נמצאו תוצאות תואמות')
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
      title="יצירת כותרות"
      size="md"
    >
      <div className="space-y-4">
        <div className="bg-blue-50 p-4 rounded-lg text-sm text-gray-700 space-y-2">
          <p>בתיבת 'מילה לחפש' יש לבחור או להקליד את המילה בה אנו רוצים שתתחיל הכותרת.</p>
          <p>לדוג': פרק/פסוק/סימן/סעיף/הלכה/שאלה/עמוד/סק/ענף</p>
          <p className="font-bold text-red-600">שים לב!</p>
          <p>אין להקליד רווח אחרי המילה, וכן אין להקליד את התו גרש (') או גרשיים (") וכן אין להקליד יותר ממילה אחת</p>
        </div>

        <FormInput
          label="מילה לחיפוש"
          value={findWord}
          onChange={(e) => setFindWord(e.target.value)}
          placeholder="דף"
        />

        <div className="grid grid-cols-2 gap-4">
          <FormInput
            label="עד מספר"
            type="number"
            value={endNumber}
            onChange={(e) => setEndNumber(parseInt(e.target.value) || 0)}
          />
          
          <FormInput
            label="רמת כותרת"
            type="number"
            value={level}
            onChange={(e) => setLevel(parseInt(e.target.value) || 2)}
            placeholder="2-6"
          />
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
