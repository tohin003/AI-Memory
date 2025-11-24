const fs = require('fs');

// Read the SVG
const svgContent = fs.readFileSync('extension/logo.svg', 'utf8');
const svgBase64 = Buffer.from(svgContent).toString('base64');
const dataUri = `data:image/svg+xml;base64,${svgBase64}`;

// Create the HTML converter
const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <style>body { background: #333; color: white; font-family: sans-serif; }</style>
</head>
<body>
    <h2>SVG to PNG Converter</h2>
    <div style="display: flex; gap: 20px;">
        <div>
            <h3>Source SVG</h3>
            <img id="source" src="${dataUri}" width="128" height="128" onload="convert()">
        </div>
        <div>
            <h3>Canvas Output</h3>
            <canvas id="canvas" width="128" height="128" style="border: 1px solid #555;"></canvas>
        </div>
    </div>
    <h3>Base64 Output:</h3>
    <textarea id="output" rows="10" cols="50"></textarea>

    <script>
        function convert() {
            const img = document.getElementById('source');
            const canvas = document.getElementById('canvas');
            const ctx = canvas.getContext('2d');
            const output = document.getElementById('output');

            // Clear canvas (transparent background)
            ctx.clearRect(0, 0, 128, 128);
            
            // Draw image
            ctx.drawImage(img, 0, 0, 128, 128);
            
            // Export to PNG
            const pngData = canvas.toDataURL('image/png');
            output.value = pngData;
            
            // Signal completion for automation
            document.body.setAttribute('data-status', 'done');
        }
    </script>
</body>
</html>
`;

fs.writeFileSync('extension/convert_final.html', htmlContent);
console.log('Conversion tool created at extension/convert_final.html');
