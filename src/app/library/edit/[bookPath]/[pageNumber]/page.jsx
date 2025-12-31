'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import Link from 'next/link'

export default function EditPage() {
    // שים לב: bookPath כאן הוא ה-slug
    const { bookPath, pageNumber } = useParams() 
    const router = useRouter()
    const { data: session, status } = useSession()
    
    const [loading, setLoading] = useState(true)
    const [pageData, setPageData] = useState(null)
    const [bookName, setBookName] = useState('')
    
    // מצבי עריכה
    const [content, setContent] = useState('')
    const [isTwoColumns, setIsTwoColumns] = useState(false)
    const [rightCol, setRightCol] = useState('')
    const [leftCol, setLeftCol] = useState('')
    const [rightColumnName, setRightColumnName] = useState('חלק 1')
    const [leftColumnName, setLeftColumnName] = useState('חלק 2')
    
    const [isSaving, setIsSaving] = useState(false)
    const [lastSaved, setLastSaved] = useState(null)

    // הגנה על הדף
    useEffect(() => {
        if (status === 'unauthenticated') router.push('/library/auth/login');
    }, [status, router]);

    // טעינת נתונים
    useEffect(() => {
        if (status !== 'authenticated') return;

        const loadData = async () => {
            try {
                // 1. קבלת פרטי העמוד והספר (כולל תמונה)
                // משתמשים ב-bookPath (שהוא ה-slug)
                const bookRes = await fetch(`/api/book/${bookPath}`);
                const bookJson = await bookRes.json();
                
                if (!bookJson.success) throw new Error(bookJson.error);
                
                setBookName(bookJson.book.name);
                const page = bookJson.pages.find(p => p.number === parseInt(pageNumber));
                
                if (!page) throw new Error('העמוד לא נמצא');
                
                // בדיקה שהעמוד אכן שייך למשתמש
                if (page.status === 'in-progress' && page.claimedBy !== session.user.name) {
                     // אולי כדאי להזהיר אבל לא לחסום לחלוטין אם רוצים לאפשר צפייה?
                     // כרגע נשאיר פתוח
                }
                
                setPageData(page);

                // 2. קבלת התוכן הקיים מה-DB
                const contentRes = await fetch(`/api/page-content?bookPath=${bookPath}&pageNumber=${pageNumber}`);
                const contentJson = await contentRes.json();
                
                if (contentJson.success && contentJson.data) {
                    setContent(contentJson.data.content || '');
                    setIsTwoColumns(contentJson.data.twoColumns || false);
                    setRightCol(contentJson.data.rightColumn || '');
                    setLeftCol(contentJson.data.leftColumn || '');
                    if (contentJson.data.rightColumnName) setRightColumnName(contentJson.data.rightColumnName);
                    if (contentJson.data.leftColumnName) setLeftColumnName(contentJson.data.leftColumnName);
                }
            } catch (err) {
                console.error(err);
                alert('שגיאה בטעינת הנתונים: ' + err.message);
            } finally {
                setLoading(false);
            }
        };

        loadData();
    }, [bookPath, pageNumber, status, router, session?.user?.name]);

    // שמירה
    const saveContent = useCallback(async () => {
        if (!pageData) return;
        setIsSaving(true);
        try {
            await fetch('/api/page-content', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    bookPath, // Slug
                    pageNumber: parseInt(pageNumber),
                    content,
                    twoColumns: isTwoColumns,
                    rightColumn: rightCol,
                    leftColumn: leftCol,
                    rightColumnName,
                    leftColumnName
                })
            });
            setLastSaved(new Date());
        } catch (error) {
            console.error('Save failed', error);
        } finally {
            setIsSaving(false);
        }
    }, [bookPath, pageNumber, content, isTwoColumns, rightCol, leftCol, rightColumnName, leftColumnName, pageData]);

    // שמירה אוטומטית
    useEffect(() => {
        const timeoutId = setTimeout(() => {
            if (!loading && pageData) {
                saveContent();
            }
        }, 3000); // שמירה כל 3 שניות ללא הקלדה

        return () => clearTimeout(timeoutId);
    }, [content, rightCol, leftCol, isTwoColumns, loading, pageData, saveContent]);

    const handleComplete = async () => {
        if (!confirm('האם סיימת לערוך את העמוד? הוא יסומן כהושלם ותקבל ניקוד.')) return;
        
        await saveContent(); // שמירה אחרונה
        
        try {
            const res = await fetch('/api/book/complete-page', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    pageId: pageData.id, // ID מונגו של העמוד
                    bookId: pageData.book // ID מונגו של הספר (אם יש ב-pageData)
                })
            });
            
            const data = await res.json();
            
            if (data.success) {
                router.push(`/library/book/${bookPath}`);
            } else {
                alert('שגיאה: ' + data.error);
            }
        } catch (err) {
            console.error(err);
            alert('שגיאה בסיום העריכה');
        }
    };

    if (loading) return (
        <div className="h-screen flex items-center justify-center bg-gray-50">
            <div className="text-center">
                <span className="material-symbols-outlined animate-spin text-5xl text-primary mb-4">settings</span>
                <p>טוען את העורך...</p>
            </div>
        </div>
    );

    return (
        <div className="h-screen flex flex-col bg-gray-50 overflow-hidden">
            {/* Toolbar */}
            <div className="bg-white border-b border-gray-200 px-4 py-2 flex items-center justify-between shadow-sm z-10 shrink-0 h-16">
                <div className="flex items-center gap-4">
                    <Link href={`/library/book/${bookPath}`} className="flex items-center text-gray-600 hover:text-primary transition-colors">
                        <span className="material-symbols-outlined">arrow_forward</span>
                        <span className="mr-1 font-medium">חזרה לספר</span>
                    </Link>
                    <div className="h-6 w-px bg-gray-300"></div>
                    <div>
                        <h1 className="font-bold text-gray-800 text-lg">{bookName}</h1>
                        <div className="flex items-center gap-2 text-sm">
                             <span className="text-gray-500">עמוד {pageNumber}</span>
                             {isSaving ? (
                                <span className="text-blue-500 flex items-center gap-1 animate-pulse">
                                    <span className="material-symbols-outlined text-sm">sync</span> שומר...
                                </span>
                            ) : (
                                <span className="text-green-600 flex items-center gap-1">
                                    <span className="material-symbols-outlined text-sm">cloud_done</span> 
                                    {lastSaved ? 'נשמר' : 'מוכן'}
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <div className="bg-gray-100 p-1 rounded-lg flex text-sm font-medium">
                        <button 
                            onClick={() => setIsTwoColumns(false)}
                            className={`px-3 py-1.5 rounded-md transition-all ${!isTwoColumns ? 'bg-white shadow text-primary' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            טור אחד
                        </button>
                        <button 
                            onClick={() => setIsTwoColumns(true)}
                            className={`px-3 py-1.5 rounded-md transition-all ${isTwoColumns ? 'bg-white shadow text-primary' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            שני טורים
                        </button>
                    </div>
                    
                    <button 
                        onClick={handleComplete}
                        className="flex items-center gap-2 px-5 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-bold shadow-sm transition-all hover:shadow hover:-translate-y-0.5"
                    >
                        <span className="material-symbols-outlined">check</span>
                        סיים עריכה
                    </button>
                </div>
            </div>

            {/* Main Area */}
            <div className="flex-1 flex overflow-hidden">
                {/* Image Pane */}
                <div className="w-1/2 bg-slate-800 p-4 overflow-auto flex items-start justify-center relative">
                    {pageData?.thumbnail ? (
                        <img 
                            src={pageData.thumbnail} 
                            alt="Page Source" 
                            className="max-w-full shadow-2xl rounded-sm"
                        />
                    ) : (
                        <div className="text-white/50 mt-20 flex flex-col items-center">
                            <span className="material-symbols-outlined text-6xl">broken_image</span>
                            <p>תמונה לא זמינה</p>
                        </div>
                    )}
                </div>

                {/* Editor Pane */}
                <div className="w-1/2 bg-white flex flex-col border-r border-gray-200 shadow-xl z-0">
                    {isTwoColumns ? (
                        <div className="flex-1 flex divide-x divide-x-reverse h-full">
                            <div className="w-1/2 flex flex-col h-full">
                                <input 
                                    type="text" 
                                    value={rightColumnName}
                                    onChange={e => setRightColumnName(e.target.value)}
                                    className="w-full p-2 text-center text-sm font-bold text-gray-500 bg-gray-50 border-b outline-none focus:bg-white transition-colors"
                                />
                                <textarea
                                    value={rightCol}
                                    onChange={e => setRightCol(e.target.value)}
                                    className="flex-1 w-full p-6 resize-none focus:outline-none text-lg leading-relaxed font-serif text-gray-800"
                                    placeholder="הקלד כאן (טור ימני)..."
                                    dir="rtl"
                                />
                            </div>
                            <div className="w-1/2 flex flex-col h-full">
                                <input 
                                    type="text" 
                                    value={leftColumnName}
                                    onChange={e => setLeftColumnName(e.target.value)}
                                    className="w-full p-2 text-center text-sm font-bold text-gray-500 bg-gray-50 border-b outline-none focus:bg-white transition-colors"
                                />
                                <textarea
                                    value={leftCol}
                                    onChange={e => setLeftCol(e.target.value)}
                                    className="flex-1 w-full p-6 resize-none focus:outline-none text-lg leading-relaxed font-serif text-gray-800 bg-slate-50/30"
                                    placeholder="הקלד כאן (טור שמאלי)..."
                                    dir="rtl"
                                />
                            </div>
                        </div>
                    ) : (
                        <textarea
                            value={content}
                            onChange={e => setContent(e.target.value)}
                            className="w-full h-full p-8 resize-none focus:outline-none text-xl leading-relaxed font-serif text-gray-800"
                            placeholder="הקלד כאן את הטקסט..."
                            dir="rtl"
                        />
                    )}
                </div>
            </div>
        </div>
    )
}