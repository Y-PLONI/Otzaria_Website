'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useDialog } from '@/components/DialogContext'

export default function AdminUploadsPage() {
  const [uploads, setUploads] = useState([])
  const [loading, setLoading] = useState(true)
  const [expandedBooks, setExpandedBooks] = useState({}) // מעקב אחרי ספרים מורחבים
  const [searchTerm, setSearchTerm] = useState('')
  const router = useRouter()
  const { showConfirm, showAlert } = useDialog()

  const loadUploads = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/admin/uploads/list')
      const data = await response.json()
      if (data.success) {
        setUploads(data.uploads)
      }
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadUploads()
  }, [])

  // חישוב ספירות מאופטם עם useMemo
  const { fullBookCount, singlePageCount } = useMemo(() => {
    return uploads.reduce((counts, upload) => {
      const type = upload.uploadType || 'single_page'
      if (type === 'full_book') {
        counts.fullBookCount++
      } else {
        counts.singlePageCount++
      }
      return counts
    }, { fullBookCount: 0, singlePageCount: 0 })
  }, [uploads])

  // פונקציה לחילוץ שם הספר הבסיסי (ללא מספר עמוד)
  const extractBaseBookName = (bookName) => {
    if (!bookName) return ''
    // הסרת דפוסים כמו: "עמוד 193", "_page_146", "page 4", וכו'
    return bookName
      .replace(/\s*עמוד\s*\d+\s*$/i, '')
      .replace(/\s*_page_\d+\s*$/i, '')
      .replace(/\s*page\s*\d+\s*$/i, '')
      .replace(/\s*-\s*עמוד\s*\d+\s*$/i, '')
      .replace(/\s*-\s*page\s*\d+\s*$/i, '')
      .trim()
  }

  // קיבוץ העלאות לפי ספרים עם סינון חיפוש
  const groupedByBook = useMemo(() => {
    const groups = {}
    
    // סינון העלאות לפי חיפוש
    const filteredUploads = uploads.filter(upload => {
      if (!searchTerm) return true
      
      const bookName = upload.bookName || ''
      const uploaderName = upload.uploadedBy || ''
      
      // נרמול הטקסט - החלפת רווחים במקפים ולהיפך
      const normalizedSearch = searchTerm.toLowerCase()
      const normalizedBookName = bookName.toLowerCase()
      const normalizedUploader = uploaderName.toLowerCase()
      
      // חיפוש רגיל
      if (normalizedBookName.includes(normalizedSearch) || normalizedUploader.includes(normalizedSearch)) {
        return true
      }
      
      // חיפוש עם החלפת רווחים למקפים
      const searchWithDash = normalizedSearch.replace(/\s+/g, '-')
      const searchWithSpace = normalizedSearch.replace(/-/g, ' ')
      
      return normalizedBookName.includes(searchWithDash) || 
             normalizedBookName.includes(searchWithSpace) ||
             normalizedUploader.includes(searchWithDash) ||
             normalizedUploader.includes(searchWithSpace)
    })
    
    filteredUploads.forEach(upload => {
      const baseBookName = extractBaseBookName(upload.bookName)
      if (!groups[baseBookName]) {
        groups[baseBookName] = []
      }
      groups[baseBookName].push(upload)
    })
    
    // מיון הקבוצות לפי תאריך העלאה אחרון
    return Object.entries(groups)
      .map(([bookName, uploads]) => ({
        bookName,
        uploads: uploads.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt)),
        latestUpload: uploads.reduce((latest, current) => 
          new Date(current.uploadedAt) > new Date(latest.uploadedAt) ? current : latest
        )
      }))
      .sort((a, b) => new Date(b.latestUpload.uploadedAt) - new Date(a.latestUpload.uploadedAt))
  }, [uploads, searchTerm])

  const toggleBookExpansion = (bookName) => {
    setExpandedBooks(prev => ({
      ...prev,
      [bookName]: !prev[bookName]
    }))
  }

  // רשימת העלאות ממתינות מאופטמת
  const pendingUploads = useMemo(() => 
    uploads.filter(u => u.status === 'pending'), 
    [uploads]
  )
  
  const pendingCount = pendingUploads.length

  const handleMoveToTrash = async (uploadId, uploadName) => {
    showConfirm(
      'העברה לאשפה',
      `האם להעביר את ההעלאה לאשפה?\n\n"${uploadName}"\n\nניתן יהיה לשחזר או למחוק לצמיתות מדף האשפה`,
      async () => {
        try {
          const res = await fetch('/api/admin/uploads/move-to-trash', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ uploadId })
          })
          
          if (res.ok) {
            // עדכון אופטימי - הסרה מהרשימה
            setUploads(prev => prev.filter(u => u.id !== uploadId))
            showAlert('הצלחה', 'ההעלאה הועברה לאשפה')
          } else {
            const data = await res.json()
            console.error('API error:', data)
            showAlert('שגיאה', data.error || 'שגיאה בהעברה לאשפה')
          }
        } catch (e) {
          console.error('Exception:', e)
          showAlert('שגיאה', 'שגיאה בהעברה לאשפה')
        }
      },
      'העבר לאשפה',
      'ביטול'
    )
  }

  // --- התיקון כאן: שימוש ב-ID להורדה ---
  const handleDownload = (uploadId, originalName) => {
      const link = document.createElement('a')
      // השרת מצפה ל-ID, לא לשם הקובץ
      link.href = `/api/download/${uploadId}` 
      link.download = originalName || 'download.txt'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
  }

  const handleDownloadAllPending = async () => {
    const pending = pendingUploads
    if (pending.length === 0) {
      showAlert('אין קבצים', 'אין קבצים להורדה')
      return
    }

    showConfirm(
      'הורדת קבצים',
      `להוריד ${pending.length} קבצים כקובץ מאוחד?`,
      async () => {
        try {
          // הורדת כל הקבצים ואיחודם
          const contents = []
          for (const upload of pending) {
            try {
              const response = await fetch(`/api/admin/uploads/download/${upload.id}`)
              if (response.ok) {
                const text = await response.text()
                contents.push(text)
              }
            } catch (error) {
              console.error(`Error downloading ${upload.originalFileName}:`, error)
            }
          }
          
          // יצירת קובץ מאוחד עם 2 מעברי שורות בין קבצים
          const combinedContent = contents.join('\n\n')
          const blob = new Blob([combinedContent], { type: 'text/plain;charset=utf-8' })
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = `combined_uploads_${new Date().toISOString().split('T')[0]}.txt`
          document.body.appendChild(a)
          a.click()
          document.body.removeChild(a)
          URL.revokeObjectURL(url)
          
          showAlert('הצלחה', 'הקובץ המאוחד הורד בהצלחה')
        } catch (error) {
          console.error('Error combining files:', error)
          showAlert('שגיאה', 'אירעה שגיאה בהורדת הקבצים')
        }
      }
    )
  }

  if (loading) return (
    <div className="flex justify-center items-center h-64">
        <span className="material-symbols-outlined animate-spin text-4xl text-primary">progress_activity</span>
    </div>
  )

  return (
    <div className="glass-strong p-6 rounded-xl animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-center gap-4 mb-6">
        <div className="flex items-center gap-4 flex-1">
          <h2 className="text-2xl font-bold text-on-surface flex items-center gap-2 whitespace-nowrap">
              <span className="material-symbols-outlined text-primary">upload_file</span>
              העלאות משתמשים
          </h2>
          
          {/* שדה חיפוש */}
          <div className="relative flex-1 max-w-md">
            <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
              search
            </span>
            <input 
              type="text"
              placeholder="חיפוש..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-lg py-2 pr-10 pl-4 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-sm text-sm"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            )}
          </div>
        </div>
        
        <div className="flex gap-2">
          <Link 
            href="/library/admin/trash"
            className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors shadow-sm"
          >
            <span className="material-symbols-outlined text-sm">delete</span>
            אשפה
          </Link>
          
          {pendingCount > 0 && (
            <button 
              onClick={handleDownloadAllPending}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
            >
              <span className="material-symbols-outlined text-sm">download</span>
              הורד הכל ({pendingCount})
            </button>
          )}
        </div>
      </div>
      
      {uploads.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <span className="material-symbols-outlined text-6xl mb-2">folder_off</span>
            <p>אין העלאות במערכת</p>
          </div>
      ) : (
          <div className="space-y-4">
              {groupedByBook.map(({ bookName, uploads: bookUploads }) => {
                  const isExpanded = expandedBooks[bookName]
                  const hasMultipleUploads = bookUploads.length > 1
                  const firstUpload = bookUploads[0]
                  
                  return (
                      <div key={bookName} className="bg-gradient-to-br from-amber-50/80 to-orange-50/60 backdrop-blur-sm p-5 rounded-xl border border-amber-200/50 hover:border-amber-300/70 transition-all shadow-sm hover:shadow-md">
                          {/* כותרת הספר */}
                          <div 
                              className={`flex items-start gap-4 ${hasMultipleUploads ? 'cursor-pointer' : ''}`}
                              onClick={() => hasMultipleUploads && toggleBookExpansion(bookName)}
                          >
                              <div className="p-3 rounded-lg bg-amber-100 text-amber-800 shadow-sm">
                                  <span className="material-symbols-outlined text-3xl">
                                      {hasMultipleUploads ? 'folder' : 'description'}
                                  </span>
                              </div>
                              
                              <div className="flex-1">
                                  <div className="flex justify-between items-start mb-2">
                                      <div>
                                          <h3 className="text-lg font-bold text-amber-950 flex items-center gap-2">
                                              {bookName || 'ללא שם'}
                                              {hasMultipleUploads && (
                                                  <span className="px-2 py-0.5 bg-amber-200 text-amber-900 text-xs rounded-full border border-amber-300 font-bold">
                                                      {bookUploads.length} העלאות
                                                  </span>
                                              )}
                                              {firstUpload.uploadType === 'full_book' && (
                                                  <span className="px-2 py-0.5 bg-orange-200 text-orange-900 text-xs rounded-full border border-orange-300 font-bold">
                                                      ספר שלם
                                                  </span>
                                              )}
                                              {firstUpload.uploadType === 'dicta' && (
                                                  <span className="px-2 py-0.5 bg-purple-200 text-purple-900 text-xs rounded-full border border-purple-300 font-bold">
                                                      דיקטה
                                                  </span>
                                              )}
                                          </h3>
                                          <div className="flex items-center gap-4 text-sm text-amber-800/80 mt-1">
                                              <span className="flex items-center gap-1">
                                                <span className="material-symbols-outlined text-sm">person</span>
                                                {firstUpload.uploadedBy || 'אורח'}
                                              </span>
                                              <span className="flex items-center gap-1">
                                                <span className="material-symbols-outlined text-sm">calendar_today</span>
                                                {new Date(firstUpload.uploadedAt).toLocaleDateString('he-IL')}
                                              </span>
                                              {!hasMultipleUploads && (
                                                  <span className="flex items-center gap-1" title={firstUpload.originalFileName}>
                                                    <span className="material-symbols-outlined text-sm">attachment</span>
                                                    <span className="truncate max-w-[150px]">{firstUpload.originalFileName}</span>
                                                  </span>
                                              )}
                                          </div>
                                      </div>
                                      
                                      <div className="flex items-center gap-2">
                                          {hasMultipleUploads && (
                                              <span className="material-symbols-outlined text-amber-600">
                                                  {isExpanded ? 'expand_less' : 'expand_more'}
                                              </span>
                                          )}
                                      </div>
                                  </div>
                                  
                                  {/* כפתורי פעולה */}
                                  <div className="flex items-center justify-end gap-2 mt-4 pt-3 border-t border-amber-200/50">
                                      {hasMultipleUploads && (
                                          <>
                                              <button 
                                                onClick={(e) => {
                                                                                                        e.stopPropagation();
                                                    showConfirm(
                                                        'הורדת קבצי ספר',
                                                        `האם להוריד את כל ${bookUploads.length} ההעלאות של "${bookName}" כקובץ מאוחד?`,
                                                        async () => {
                                                            const contents = [];
                                                            for (const upload of bookUploads) {
                                                                try {
                                                                    const response = await fetch(`/api/download/${upload.id}`);
                                                                    if (response.ok) {
                                                                        const text = await response.text();
                                                                        contents.push(`--- ${upload.originalFileName} ---\n\n${text}`);
                                                                    }
                                                                } catch (error) {
                                                                    console.error(`Error downloading ${upload.originalFileName}:`, error);
                                                                }
                                                            }
                                                            
                                                            const combinedContent = contents.join('\n\n\n');
                                                            const blob = new Blob([combinedContent], { type: 'text/plain;charset=utf-8' });
                                                            const url = URL.createObjectURL(blob);
                                                            const a = document.createElement('a');
                                                            a.href = url;
                                                            a.download = `${bookName}_uploads.txt`;
                                                            document.body.appendChild(a);
                                                            a.click();
                                                            document.body.removeChild(a);
                                                            URL.revokeObjectURL(url);
                                                            showAlert('הצלחה', 'הקובץ המאוחד הורד בהצלחה');
                                                        }
                                                    );
                                                }}
                                                className="flex items-center gap-1 px-3 py-1.5 text-amber-700 hover:bg-amber-100 rounded-lg text-sm transition-colors"
                                              >
                                                  <span className="material-symbols-outlined text-lg">download</span>
                                                  הורד הכל ({bookUploads.length})
                                              </button>
                                              
                                              <div className="w-px h-6 bg-amber-300 mx-1"></div>
                                              
                                              <button 
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    showConfirm(
                                                        'העברה לאשפה',
                                                        `האם להעביר את כל ${bookUploads.length} ההעלאות של "${bookName}" לאשפה?`,
                                                        async () => {
                                                            for (const upload of bookUploads) {
                                                                try {
                                                                    await fetch('/api/admin/uploads/move-to-trash', {
                                                                        method: 'PUT',
                                                                        headers: { 'Content-Type': 'application/json' },
                                                                        body: JSON.stringify({ uploadId: upload.id })
                                                                    })
                                                                } catch (e) {
                                                                    console.error('Error moving to trash:', e)
                                                                }
                                                            }
                                                            setUploads(prev => prev.filter(u => !bookUploads.find(bu => bu.id === u.id)))
                                                            showAlert('הצלחה', `${bookUploads.length} העלאות הועברו לאשפה`)
                                                        },
                                                        'העבר הכל לאשפה',
                                                        'ביטול'
                                                    )
                                                }}
                                                className="flex items-center gap-1 px-3 py-1.5 text-red-700 hover:bg-red-50 rounded-lg text-sm transition-colors"
                                              >
                                                  <span className="material-symbols-outlined text-lg">delete</span>
                                                  העבר הכל לאשפה
                                              </button>
                                          </>
                                      )}
                                      
                                      {!hasMultipleUploads && (
                                          <>
                                              <button 
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    handleDownload(firstUpload.id, firstUpload.originalFileName)
                                                }}
                                                className="flex items-center gap-1 px-3 py-1.5 text-amber-700 hover:bg-amber-100 rounded-lg text-sm transition-colors"
                                              >
                                                  <span className="material-symbols-outlined text-lg">download</span>
                                                  הורד קובץ
                                              </button>
                                              
                                              <div className="w-px h-6 bg-amber-300 mx-1"></div>
                                              
                                              <button 
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    handleMoveToTrash(firstUpload.id, firstUpload.bookName)
                                                }}
                                                className="flex items-center gap-1 px-3 py-1.5 text-red-700 hover:bg-red-50 rounded-lg text-sm transition-colors"
                                              >
                                                  <span className="material-symbols-outlined text-lg">delete</span>
                                                  העבר לאשפה
                                              </button>
                                          </>
                                      )}
                                  </div>
                              </div>
                          </div>
                          
                          {/* רשימת העלאות מורחבת */}
                          {hasMultipleUploads && isExpanded && (
                              <div className="mt-4 mr-16 space-y-3 border-r-2 border-amber-300 pr-4">
                                  {bookUploads.map(upload => (
                                      <div key={upload.id} className="bg-white/70 backdrop-blur-sm p-4 rounded-lg border border-amber-200 shadow-sm">
                                          <div className="flex justify-between items-start mb-2">
                                              <div className="flex-1">
                                                  <h4 className="font-semibold text-amber-950">
                                                      {upload.bookName}
                                                  </h4>
                                                  <div className="flex items-center gap-4 text-xs text-amber-800/70 mt-1">
                                                      <span className="flex items-center gap-1">
                                                        <span className="material-symbols-outlined text-xs">person</span>
                                                        {upload.uploadedBy || 'אורח'}
                                                      </span>
                                                      <span className="flex items-center gap-1">
                                                        <span className="material-symbols-outlined text-xs">calendar_today</span>
                                                        {new Date(upload.uploadedAt).toLocaleDateString('he-IL')}
                                                      </span>
                                                      <span className="flex items-center gap-1" title={upload.originalFileName}>
                                                        <span className="material-symbols-outlined text-xs">attachment</span>
                                                        <span className="truncate max-w-[150px]">{upload.originalFileName}</span>
                                                      </span>
                                                  </div>
                                              </div>
                                          </div>
                                          
                                          <div className="flex items-center justify-end gap-2 mt-3 pt-2 border-t border-amber-200/50">
                                              <button 
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    handleDownload(upload.id, upload.originalFileName)
                                                }}
                                                className="flex items-center gap-1 px-3 py-1.5 text-amber-700 hover:bg-amber-100 rounded-lg text-xs transition-colors"
                                              >
                                                  <span className="material-symbols-outlined text-sm">download</span>
                                                  הורד
                                              </button>
                                              
                                              <div className="w-px h-5 bg-amber-300 mx-1"></div>
                                              
                                              <button 
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    handleMoveToTrash(upload.id, upload.bookName)
                                                }}
                                                className="flex items-center gap-1 px-3 py-1.5 text-red-700 hover:bg-red-50 rounded-lg text-xs transition-colors"
                                              >
                                                  <span className="material-symbols-outlined text-sm">delete</span>
                                                  העבר לאשפה
                                              </button>
                                          </div>
                                      </div>
                                  ))}
                              </div>
                          )}
                      </div>
                  )
              })}
          </div>
      )}
    </div>
  )
}
