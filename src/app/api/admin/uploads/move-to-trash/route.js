import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectDB from '@/lib/db';
import Upload from '@/models/Upload';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

export async function PUT(request) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { uploadId } = await request.json();
    
    if (!uploadId) {
      return NextResponse.json({ error: 'Upload ID is required' }, { status: 400 });
    }

    await connectDB();
    
    console.log('Moving to trash:', uploadId);
    
    const result = await Upload.findByIdAndUpdate(
      uploadId,
      { 
        isDeleted: true,
        deletedAt: new Date()
      },
      { new: true }
    );
    
    if (!result) {
      console.log('Upload not found:', uploadId);
      return NextResponse.json({ error: 'Upload not found' }, { status: 404 });
    }
    
    console.log('Successfully moved to trash:', {
      id: result._id,
      isDeleted: result.isDeleted,
      deletedAt: result.deletedAt,
      updateResult: {
        matchedCount: updateResult.matchedCount,
        modifiedCount: updateResult.modifiedCount
      }
    });

    return NextResponse.json({ 
      success: true, 
      message: 'Upload moved to trash',
      upload: {
        id: result._id,
        isDeleted: result.isDeleted,
        deletedAt: result.deletedAt
      }
    });
  } catch (error) {
    console.error('Error moving upload to trash:', error);
    return NextResponse.json({ error: 'Failed to move upload to trash' }, { status: 500 });
  }
}
