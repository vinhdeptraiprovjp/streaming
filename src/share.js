const path = require('path');

const { exec } = require('child_process');
const MAXIMUM_BITRATE_720P = 5 * 10 ** 6 // 5Mbps
const MAXIMUM_BITRATE_1080P = 8 * 10 ** 6 // 8Mbps
const MAXIMUM_BITRATE_1440P = 16 * 10 ** 6 // 16Mbps
const MAXIMUM_BITRATE_480P = 4 * 10 ** 6 // 4Mbps
const MAXIMUM_BITRATE_240P = 8 * 10 ** 5 // 0.8Mbps

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
    const bitrate240 = bitrate > MAXIMUM_BITRATE_240P ? MAXIMUM_BITRATE_240P : bitrate
    const bitrate480 = bitrate > MAXIMUM_BITRATE_480P ? MAXIMUM_BITRATE_480P : bitrate
    const bitrate720 = bitrate > MAXIMUM_BITRATE_720P ? MAXIMUM_BITRATE_720P : bitrate
    const bitrate1080 = bitrate > MAXIMUM_BITRATE_1080P ? MAXIMUM_BITRATE_1080P : bitrate
    const bitrate1440 = bitrate > MAXIMUM_BITRATE_1440P ? MAXIMUM_BITRATE_1440P : bitrate
    const commandWithMax720 = `
  ffmpeg -y -i ${inputPath} 
  -preset veryslow -g 48 -crf 17 -sc_threshold 0 
  -map 0:0 -map 0:1 -map 0:0 -map 0:1 -map 0:0 -map 0:1 
  -s:v:0 ${getWidth(240, resolution)}x240 -c:v:0 libx264 -b:v:0 ${bitrate240} 
  -s:v:1 ${getWidth(480, resolution)}x480 -c:v:1 libx264 -b:v:1 ${bitrate480} 
  -s:v:2 ${getWidth(720, resolution)}x720 -c:v:2 libx264 -b:v:2 ${bitrate720} 
  -c:a copy 
  -var_stream_map "v:0,a:0 v:1,a:1 v:2,a:2" 
  -master_pl_name master.m3u8 
  -f hls -hls_time 6 -hls_list_size 0 
  -hls_segment_filename "${outputSegmentPath}" 
  ${outputPath}
`
    const commandWithMax1080 = `ffmpeg -y -i ${inputPath} -preset veryslow -g 48 -crf 17 -sc_threshold 0 -map 0:0 -map 0:1 -map 0:0 -map 0:1 -map 0:0 -map 0:1 -map 0:0 -map 0:1 -s:v:0 ${getWidth(240, resolution)}x240 -c:v:0 libx264 -b:v:0 ${bitrate240} -s:v:1 ${getWidth(480, resolution)}x480 -c:v:1 libx264 -b:v:1 ${bitrate480} -s:v:2 ${getWidth(720, resolution)}x720 -c:v:2 libx264 -b:v:2 ${bitrate720} -s:v:3 ${getWidth(1080, resolution)}x1080 -c:v:3 libx264 -b:v:3 ${bitrate1080} -c:a copy -var_stream_map "v:0,a:0 v:1,a:1 v:2,a:2 v:3,a:3" -master_pl_name master.m3u8 -f hls -hls_time 6 -hls_list_size 0 -hls_segment_filename "${outputSegmentPath}" ${outputPath}`
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
    let type = '720';
    if (resolution.height > 720) {
        command = commandWithMax1080
        type = '1080'
    }
    if (resolution.height > 1080) {
        command = commandWithMax1440
        type = '1440'
    }
    if (resolution.height > 1440) {
        command = commandWithOriginalWidth
        type = 'original'
    }
    console.log(command, 'command')
    console.log(type, 'type')
    return new Promise((resolve, reject) => {
        exec(command, (err, stdout, stderr) => {
            if (err) {
                return reject(err)
            }
            resolve(true)
        })
    })
}
module.exports = {
    encodeHLSWithMultipleVideoStreams,
}