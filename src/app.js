// app.js
const express = require('express');
// const formidable = require('formidable');
const path = require('path');
const fs = require('fs');
const mine = require('mine');

const app = express();
const port = 8008;
app.use(express.static(path.join(__dirname, 'public')));
app.post('/upload', async (req, res) => {
    const formidable = (await import('formidable')).default;
    const form = formidable({
        uploadDir: path.join(__dirname, 'public/uploads'),
        maxFiles: 1,
        keepExtensions: true,
        // maxFileSize: 300 * 1024,
    });

    form.parse(req, (err, fields, files) => {
        if (err) {
            console.log(err, 'err')
            return res.status(500).json({ error: 'Error while processing file upload.' });
        }

        // 'file' is the name attribute of the file input in your form
        const uploadedFile = files.file[0];
        // Create a URL for the uploaded file
        const fileUrl = `/uploads/${uploadedFile.newFilename}`;

        res.status(200).json({ message: 'File uploaded successfully!', fileUrl, });
    });
});
app.get('/streaming/:name', async (req, res) => {
    const range = req.headers.range;
    if (!range) return res.status(403).send('Requires Range Header');

    const { name } = req.params;

    const videoPath = `${path.join(__dirname, 'public/uploads')}/${name}`;
    // 1 MB = 10* 6 bytes (Tính theo thập phân), trên trình duyệt
    // nhị phân 1 MB = 2*20 (1024 * 1024)
    // Dung lượng video (bytes)
    const videoSize = fs.statSync(videoPath).size;

    // Dung lượng video cho mỗi phân đoạn stream
    const chunkSize = 10 ** 6 // 1MB

    // Lấy giá trị byte bắt đầu từ header Range (vd: bytes=1823834)
    const start = Number(range.replace(/\D/g, ''));

    // Lấy giá trị byte kết thúc, vượt quá dung lượng video thì lấy giá trị videoSize
    const end = Math.min(start + chunkSize, videoSize - 1);

    // Dung lượng thực tế cho mỗi đoạn video stream
    const contentLength = end - start + 1;

    // const contentType = mine.getType(videoPath) || "video/*";
    const contentType = 'video/mp4';
    const headers = {
        'Content-Range': `bytes ${start}-${end}/${videoSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': contentLength,
        'Content-Type': contentType,
    }

    res.writeHead(206, headers);
    const videoStream = fs.createReadStream(videoPath, { start, end });
    videoStream.pipe(res);
});
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
