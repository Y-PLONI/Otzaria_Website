import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Book from '@/models/Book';
import Page from '@/models/Page';
import User from '@/models/User';
import DictaBook from '@/models/DictaBook';

export async function GET() {
  try {
    await connectDB();

    const [usersCount, booksCount, pagesStats, dictaBooksCount] = await Promise.all([
        User.countDocuments(),
        
        Book.countDocuments({ 
            isHidden: { $ne: true },
            $or: [
                { ownerId: { $exists: false } },
                { ownerId: null }
            ],
            isPrivate: { $ne: true }
        }), 
        
        Page.aggregate([
            {
                $lookup: {
                    from: 'books',       
                    localField: 'book',  
                    foreignField: '_id', 
                    as: 'bookData'
                }
            },
            {
                $match: {
                    'bookData.isHidden': { $ne: true },
                    'status': 'completed'
                }
            },
            {
                $group: {
                    _id: null,
                    totalPages: { $sum: 1 },
                    completedPages: { 
                        $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] } 
                    },
                    inProgressPages: { 
                        $sum: { $cond: [{ $eq: ["$status", "in-progress"] }, 1, 0] } 
                    }
                }
            }
        ]),
        
        DictaBook.countDocuments({ status: 'completed' })
    ]);

    const stats = pagesStats[0] || { totalPages: 0, completedPages: 0, inProgressPages: 0 };

    return NextResponse.json({
        success: true,
        stats: {
            users: { total: usersCount },
            books: { total: booksCount },
            totalPages: stats.totalPages,
            completedPages: stats.completedPages,
            inProgressPages: stats.inProgressPages,
            completionRate: stats.totalPages > 0 ? (stats.completedPages / stats.totalPages) * 100 : 0,
            dictaBooks: { completed: dictaBooksCount }
        }
    });
  } catch (error) {
    console.error('Stats API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}