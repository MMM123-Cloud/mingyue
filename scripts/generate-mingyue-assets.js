const fs = require('fs')
const path = require('path')
const { PNG } = require('pngjs')

const root = path.resolve(__dirname, '..')
const sourcePath = 'C:/Users/zjf20/Downloads/1790502410636.png'
const source = PNG.sync.read(fs.readFileSync(sourcePath))

function resize(image, width, height) {
    const output = new PNG({ width, height })

    for (let y = 0; y < height; y++) {
        const sourceY = ((y + 0.5) * image.height) / height - 0.5
        const y0 = Math.max(0, Math.floor(sourceY))
        const y1 = Math.min(image.height - 1, y0 + 1)
        const fy = sourceY - y0

        for (let x = 0; x < width; x++) {
            const sourceX = ((x + 0.5) * image.width) / width - 0.5
            const x0 = Math.max(0, Math.floor(sourceX))
            const x1 = Math.min(image.width - 1, x0 + 1)
            const fx = sourceX - x0
            const target = (y * width + x) * 4

            for (let channel = 0; channel < 4; channel++) {
                const topLeft = image.data[(y0 * image.width + x0) * 4 + channel]
                const topRight = image.data[(y0 * image.width + x1) * 4 + channel]
                const bottomLeft = image.data[(y1 * image.width + x0) * 4 + channel]
                const bottomRight = image.data[(y1 * image.width + x1) * 4 + channel]
                const top = topLeft + (topRight - topLeft) * fx
                const bottom = bottomLeft + (bottomRight - bottomLeft) * fx
                output.data[target + channel] = Math.round(top + (bottom - top) * fy)
            }
        }
    }

    return output
}

function circleCoverage(x, y, centerX, centerY, radius) {
    const samples = 4
    let hits = 0

    for (let sampleY = 0; sampleY < samples; sampleY++) {
        const py = y + (sampleY + 0.5) / samples
        const dy = py - centerY

        for (let sampleX = 0; sampleX < samples; sampleX++) {
            const px = x + (sampleX + 0.5) / samples
            const dx = px - centerX

            if (dx * dx + dy * dy <= radius * radius) hits++
        }
    }

    return hits / (samples * samples)
}

function composite(base, overlay, alpha) {
    const inverse = 1 - alpha
    return [
        Math.round(overlay[0] * alpha + base[0] * inverse),
        Math.round(overlay[1] * alpha + base[1] * inverse),
        Math.round(overlay[2] * alpha + base[2] * inverse),
        Math.round(overlay[3] * alpha + base[3] * inverse),
    ]
}

function makeImage(width, height, colorAt) {
    const image = new PNG({ width, height })

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const color = colorAt(x, y, width, height)
            const index = (y * width + x) * 4
            image.data[index] = color[0]
            image.data[index + 1] = color[1]
            image.data[index + 2] = color[2]
            image.data[index + 3] = color[3]
        }
    }

    return image
}

function fullIcon(size) {
    return makeImage(size, size, (x, y, width) => {
        const coverage = circleCoverage(x, y, width / 2, width / 2, width * 0.361)
        return composite([0, 0, 0, 255], [255, 255, 255, 255], coverage)
    })
}

function roundIcon(size) {
    return makeImage(size, size, (x, y, width) => {
        const outerCoverage = circleCoverage(x, y, width / 2, width / 2, width * 0.5)
        const moonCoverage = circleCoverage(x, y, width / 2, width / 2, width * 0.361)
        const background = composite([0, 0, 0, 0], [0, 0, 0, 255], outerCoverage)
        return composite(background, [255, 255, 255, 255], moonCoverage)
    })
}

function moonForeground(size) {
    return makeImage(size, size, (x, y, width) => {
        const coverage = circleCoverage(x, y, width / 2, width / 2, width * 0.33)
        return [255, 255, 255, Math.round(coverage * 255)]
    })
}

function solidBlack(size) {
    return makeImage(size, size, () => [0, 0, 0, 255])
}

function writeImage(relativePath, image) {
    const outputPath = path.join(root, relativePath)
    fs.mkdirSync(path.dirname(outputPath), { recursive: true })
    fs.writeFileSync(outputPath, PNG.sync.write(image))
    console.log(`${relativePath} ${image.width}x${image.height}`)
}

function writeDensitySet(directory, size) {
    const base = path.join('android/app/src/main/res', directory)
    writeImage(path.join(base, 'ic_launcher.png'), fullIcon(size))
    writeImage(path.join(base, 'ic_launcher_round.png'), roundIcon(size))
    writeImage(path.join(base, 'ic_launcher_background.png'), solidBlack(size))
    writeImage(path.join(base, 'ic_launcher_foreground.png'), moonForeground(size))
    writeImage(path.join(base, 'ic_launcher_monochrome.png'), moonForeground(size))
}

const densitySizes = {
    mdpi: 48,
    hdpi: 72,
    xhdpi: 96,
    xxhdpi: 144,
    xxxhdpi: 192,
}

const adaptiveSizes = {
    mdpi: 108,
    hdpi: 162,
    xhdpi: 216,
    xxhdpi: 324,
    xxxhdpi: 432,
}

for (const [density, size] of Object.entries(densitySizes)) {
    writeDensitySet(`mipmap-${density}`, size)
}

for (const [density, size] of Object.entries(adaptiveSizes)) {
    const directory = path.join(root, 'android/app/src/main/res', `mipmap-${density}`)
    for (const name of [
        'ic_launcher.webp',
        'ic_launcher_round.webp',
        'ic_launcher_background.webp',
        'ic_launcher_foreground.webp',
        'ic_launcher_monochrome.webp',
    ]) {
        const filePath = path.join(directory, name)
        if (fs.existsSync(filePath)) fs.rmSync(filePath)
    }

    writeImage(path.join('android/app/src/main/res', `mipmap-${density}`, 'ic_launcher_background.png'), solidBlack(size))
    writeImage(path.join('android/app/src/main/res', `mipmap-${density}`, 'ic_launcher_foreground.png'), moonForeground(size))
    writeImage(path.join('android/app/src/main/res', `mipmap-${density}`, 'ic_launcher_monochrome.png'), moonForeground(size))
}

const notificationSizes = {
    mdpi: 24,
    hdpi: 36,
    xhdpi: 48,
    xxhdpi: 72,
    xxxhdpi: 96,
}

for (const [density, size] of Object.entries(notificationSizes)) {
    writeImage(path.join('android/app/src/main/res', `drawable-${density}`, 'notification_icon.png'), moonForeground(size))
}

const splashSizes = {
    mdpi: 288,
    hdpi: 432,
    xhdpi: 576,
    xxhdpi: 864,
    xxxhdpi: 1152,
}

for (const [density, size] of Object.entries(splashSizes)) {
    writeImage(path.join('android/app/src/main/res', `drawable-${density}`, 'splashscreen_logo.png'), fullIcon(size))
}

writeImage('assets/images/icon.png', fullIcon(1024))
writeImage('assets/images/adaptive-icon.png', fullIcon(1024))
writeImage('assets/images/adaptive-icon-background.png', solidBlack(1024))
writeImage('assets/images/adaptive-icon-foreground.png', moonForeground(1024))
writeImage('assets/images/ios-dark.png', fullIcon(1025))
writeImage('assets/images/ios-light.png', fullIcon(1025))
writeImage('assets/images/notification.png', moonForeground(96))
writeImage('assets/images/splash.png', fullIcon(1024))

const sourcePreview = resize(source, 512, 512)
writeImage('work/mingyue-source-preview.png', sourcePreview)
