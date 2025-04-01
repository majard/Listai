const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const sizes = [48, 72, 96, 144, 192, 384, 512];

async function generateIcons() {
    const baseOutputDir = path.join(__dirname, '../android/app/src/main/res');
    const assetsDir = path.join(__dirname, '../assets');

    // Create base directory if it doesn't exist
    if (!fs.existsSync(baseOutputDir)) {
        fs.mkdirSync(baseOutputDir, { recursive: true });
    }

    // Generate regular icons for Android
    const regularIconPath = path.join(assetsDir, 'icon.svg');
    for (const size of sizes) {
        const dirPath = path.join(baseOutputDir, `mipmap-${size}dpi`);
        
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
        }

        const outputPath = path.join(dirPath, 'ic_launcher.png');
        
        await sharp(regularIconPath)
            .resize(size, size)
            .png()
            .toFile(outputPath);
            
        console.log(`Generated regular ${size}x${size} icon at ${outputPath}`);
    }

    // Generate adaptive icons for Android
    const adaptiveIconPath = path.join(assetsDir, 'adaptive-icon.svg');
    for (const size of sizes) {
        const dirPath = path.join(baseOutputDir, `mipmap-${size}dpi`);
        
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
        }

        const outputPath = path.join(dirPath, 'ic_launcher_foreground.png');
        
        await sharp(adaptiveIconPath)
            .resize(size, size)
            .png()
            .toFile(outputPath);
            
        console.log(`Generated adaptive ${size}x${size} icon at ${outputPath}`);
    }

    // Generate PNGs for Expo
    await sharp(regularIconPath)
        .resize(1024, 1024)
        .png()
        .toFile(path.join(assetsDir, 'icon.png'));
        
    await sharp(adaptiveIconPath)
        .resize(1024, 1024)
        .png()
        .toFile(path.join(assetsDir, 'adaptive-icon.png'));
        
    console.log('Generated Expo icons in assets folder');
}

generateIcons().catch(console.error); 