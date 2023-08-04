const { exec } = require('child_process');
const cors = require('cors');

const MAXIMUM_BITRATE_720P = 5 * 10 ** 6 // 5Mbps
const MAXIMUM_BITRATE_1080P = 8 * 10 ** 6 // 8Mbps
const MAXIMUM_BITRATE_1440P = 16 * 10 ** 6 // 16Mbps
const MAXIMUM_BITRATE_480P = 4 * 10 ** 6 // 4Mbps

const getBitrate = (filePath) => {
    return new Promise((resolve, reject) => {
        exec(
            `ffprobe -v error -select_streams v:0 -show_entries stream=bit_rate -of default=nw=1:nk=1 ${filePath}`,
            (err, stdout, stderr) => {
                if (err) {
                    return reject(err)
                }
                resolve(Number(stdout.trim()))
            }
        )
    })
}

const getResolution = (filePath) => {
    return new Promise((resolve, reject) => {
        exec(
            `ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=s=x:p=0 ${filePath}`,
            (err, stdout, stderr) => {
                if (err) {
                    return reject(err)
                }
                const resolution = stdout.trim().split('x')
                const [width, height] = resolution
                resolve({
                    width: Number(width),
                    height: Number(height)
                })
            }
        )
    })
}

const getWidth = (height, resolution) => {
    const width = Math.round((height * resolution.width) / resolution.height)
    // Vì ffmpeg yêu cầu width và height phải là số chẵn
    return width % 2 === 0 ? width : width + 1
}

const encodeHLSWithMultipleVideoStreams = async (inputPath, name) => {
    const [bitrate, resolution] = await Promise.all([getBitrate(inputPath), getResolution(inputPath)])
    const parent_folder = path.join(inputPath, '..')
    const outputSegmentPath = path.join(parent_folder, `${name}/v%v/fileSequence%d.ts`)
    const outputPath = path.join(parent_folder, `${name}/v%v/prog_index.m3u8`)
    const bitrate480 = bitrate > MAXIMUM_BITRATE_480P ? MAXIMUM_BITRATE_480P : bitrate
    const bitrate720 = bitrate > MAXIMUM_BITRATE_720P ? MAXIMUM_BITRATE_720P : bitrate
    const bitrate1080 = bitrate > MAXIMUM_BITRATE_1080P ? MAXIMUM_BITRATE_1080P : bitrate
    const bitrate1440 = bitrate > MAXIMUM_BITRATE_1440P ? MAXIMUM_BITRATE_1440P : bitrate
    const commandWithMax720 = `
  ffmpeg -y -i ${inputPath} \\
  -preset veryslow -g 48 -crf 17 -sc_threshold 0 \
  -map 0:0 -map 0:1 \\
  -s:v:0 ${getWidth(720, resolution)}x720 -c:v:0 libx264 -b:v:0 ${bitrate720} \\
  -c:a copy \\
  -var_stream_map "v:0,a:0" \\
  -master_pl_name master.m3u8 \\
  -f hls -hls_time 6 -hls_list_size 0 \\
  -hls_segment_filename "${outputSegmentPath}" \\
  ${outputPath}
`
    //   ffmpeg -y -i ${inputPath} \\
    //   -preset veryslow -g 48 -crf 17 -sc_threshold 0 \
    //   -map 0:0 -map 0:1 -map 0:0 -map 0:1 \\
    //   -s:v:0 ${getWidth(480, resolution)}x480 -c:v:0 libx264 -b:v:0 ${bitrate480} \\
    //   -s:v:1 ${getWidth(720, resolution)}x720 -c:v:1 libx264 -b:v:1 ${bitrate720} \\
    //   -s:v:2 ${getWidth(1080, resolution)}x1080 -c:v:2 libx264 -b:v:2 ${bitrate1080} \\
    //   -c:a copy \\
    //   -var_stream_map "v:0,a:0 v:1,a:1" \\
    //   -master_pl_name master.m3u8 \\
    //   -f hls -hls_time 6 -hls_list_size 0 \\
    //   -hls_segment_filename "${outputSegmentPath}" \\
    //   ${outputPath}
    const commandWithMax1080 = `ffmpeg -y -i ${inputPath} -preset veryslow -g 48 -crf 17 -sc_threshold 0 -map 0:0 -map 0:1 -map 0:0 -map 0:1 -map 0:0 -map 0:1 -s:v:0 ${getWidth(480, resolution)}x480 -c:v:0 libx264 -b:v:0 ${bitrate480} -s:v:1 ${getWidth(720, resolution)}x720 -c:v:1 libx264 -b:v:1 ${bitrate720} -s:v:2 ${getWidth(1080, resolution)}x1080 -c:v:2 libx264 -b:v:2 ${bitrate1080} -c:a copy -var_stream_map "v:0,a:0 v:1,a:1 v:2,a:2" -master_pl_name master.m3u8 -f hls -hls_time 6 -hls_list_size 0 -hls_segment_filename "${outputSegmentPath}" ${outputPath}`
    // const commandWithMax1080 = `ffmpeg -y -i ${inputPath} -c:v libx264 -c:a aac -b:v 3000k -b:a 128k -hls_time 10 -hls_list_size 0 -hls_segment_filename "${outputSegmentPath}" outputtt.m3u8`
    const commandWithMax1440 = `
  ffmpeg -y -i ${inputPath} \\
  -preset veryslow -g 48 -crf 17 -sc_threshold 0 \
  -map 0:0 -map 0:1 -map 0:0 -map 0:1 -map 0:0 -map 0:1 \\
  -s:v:0 ${getWidth(720, resolution)}x720 -c:v:0 libx264 -b:v:0 ${bitrate720} \\
  -s:v:1 ${getWidth(1080, resolution)}x1080 -c:v:1 libx264 -b:v:1 ${bitrate1080} \\
  -s:v:2 ${getWidth(1440, resolution)}x1440 -c:v:2 libx264 -b:v:2 ${bitrate1440} \\
  -c:a copy \\
  -var_stream_map "v:0,a:0 v:1,a:1 v:2,a:2" \\
  -master_pl_name master.m3u8 \\
  -f hls -hls_time 6 -hls_list_size 0 \\
  -hls_segment_filename "${outputSegmentPath}" \\
  ${outputPath}
`

    const commandWithOriginalWidth = `
ffmpeg -y -i ${inputPath} \\
-preset veryslow -g 48 -crf 17 -sc_threshold 0 \
-map 0:0 -map 0:1 -map 0:0 -map 0:1 -map 0:0 -map 0:1 \\
-s:v:0 ${getWidth(720, resolution)}x720 -c:v:0 libx264 -b:v:0 ${bitrate720} \\
-s:v:1 ${getWidth(1080, resolution)}x1080 -c:v:1 libx264 -b:v:1 ${bitrate1080} \\
-c:v:2 libx264 -b:v:2 ${bitrate} \\
-c:a copy \\
-var_stream_map "v:0,a:0 v:1,a:1 v:2,a:2" \\
-master_pl_name master.m3u8 \\
-f hls -hls_time 6 -hls_list_size 0 \\
-hls_segment_filename '${outputSegmentPath}' \\
${outputPath}
`
    let command = commandWithMax720
    if (resolution.height > 720) {
        command = commandWithMax1080
    }
    if (resolution.height > 1080) {
        command = commandWithMax1440
    }
    if (resolution.height > 1440) {
        command = commandWithOriginalWidth
    }
    console.log(command, 'command')
    return new Promise((resolve, reject) => {
        exec(command, (err, stdout, stderr) => {
            if (err) {
                return reject(err)
            }
            resolve(true)
        })
    })
}
// app.js
const express = require('express');
// const formidable = require('formidable');
const path = require('path');
const fs = require('fs');
const mine = require('mine');

const app = express();
const port = 8008;
const corsOptions = {
    methods: ['OPTIONS', 'GET', 'PUT', 'POST', 'DELETE'],
    allowedHeaders: [
        'Origin',
        'Content-Type',
        'Accept',
        'x-access-token',
        'x-auth-token',
        'x-xsrf-token',
        'authorization',
        'Access-Control-Allow-Origin',
        'x-language',
    ],
    credentials: true,
    optionsSuccessStatus: 200,
};
app.use(cors(corsOptions));
app.use(express.static(path.join(__dirname, 'public')));
app.post('/uploadHls', async (req, res) => {
    const formidable = (await import('formidable')).default;
    const form = formidable({
        uploadDir: path.join(__dirname, 'public/uploads'),
        maxFiles: 1,
        keepExtensions: true,
        // maxFileSize: 300 * 1024,
    });

    form.parse(req, async (err, fields, files) => {
        if (err) {
            console.log(err, 'err')
            return res.status(500).json({ error: 'Error while processing file upload.' });
        }

        // 'file' is the name attribute of the file input in your form
        const uploadedFile = files.file[0];
        const name = path.parse(uploadedFile.newFilename).name;
        // Create a URL for the uploaded file
        const fileUrl = `D:/video/src/public/uploads/${uploadedFile.newFilename}`;
        const tt = await encodeHLSWithMultipleVideoStreams(fileUrl, name);
        res.status(200).json({ message: 'File uploaded successfully!', fileUrl, });
    });
});
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
// Adapting streaming: hls and dash