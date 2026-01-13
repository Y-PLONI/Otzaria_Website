import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import OcrExample from '@/models/OcrExample';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import path from 'path';
import fs from 'fs-extra';

const UPLOAD_ROOT = process.env.UPLOAD_DIR || path.join(process.cwd(), 'public', 'uploads');

export async function GET() {
    await connectDB();
    const examples = await OcrExample.find({}).sort({ createdAt: -1 });
    
    // שליפת סוגים ייחודיים
    const types = [...new Set(examples.map(e => e.scriptType))];

    return NextResponse.json({ success: true, examples, types });
}

export async function POST(request) {
    try {
        const session = await getServerSession(authOptions);
        if (session?.user?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

        const formData = await request.formData();
        const file = formData.get('image');
        const name = formData.get('name');
        const scriptType = formData.get('scriptType');
        const layoutType = formData.get('layoutType');
        const expectedOutputStr = formData.get('expectedOutput'); // JSON string

        if (!file || !name || !expectedOutputStr) {
            return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
        }

        let expectedOutput;
        try {
            expectedOutput = JSON.parse(expectedOutputStr);
        } catch (e) {
            return NextResponse.json({ error: 'Invalid JSON in expectedOutput' }, { status: 400 });
        }

        // שמירת התמונה
        const examplesDir = path.join(UPLOAD_ROOT, 'ocr-examples');
        await fs.ensureDir(examplesDir);
        
        const ext = path.extname(file.name);
        const fileName = `${scriptType}-${Date.now()}${ext}`;
        const filePath = path.join(examplesDir, fileName);
        
        const buffer = Buffer.from(await file.arrayBuffer());
        await fs.writeFile(filePath, buffer);

        await connectDB();
        const example = await OcrExample.create({
            name,
            scriptType,
            layoutType,
            imagePath: `/uploads/ocr-examples/${fileName}`,
            expectedOutput
        });

        return NextResponse.json({ success: true, example });

    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}