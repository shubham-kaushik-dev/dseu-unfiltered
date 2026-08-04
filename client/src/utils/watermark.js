/**
 * Applies a text watermark "DSEU Unfiltered" to the bottom-right corner of an image.
 * Uses HTML5 Canvas and returns a Promise resolving to a Blob.
 * 
 * @param {File} file - The uploaded image file
 * @returns {Promise<Blob>} - Promise resolving to the watermarked image Blob
 */
export function applyMemeWatermark(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        // Create canvas
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        // Set dimensions to match original image
        canvas.width = img.width;
        canvas.height = img.height;

        // Draw original image
        ctx.drawImage(img, 0, 0);

        // Configure watermark styling dynamically based on image size
        const fontSize = Math.max(Math.round(canvas.width * 0.035), 16);
        ctx.font = `bold ${fontSize}px 'Inter', sans-serif`;
        ctx.textAlign = 'right';
        ctx.textBaseline = 'bottom';

        // Draw shadow for visibility on light/dark backgrounds
        ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
        ctx.shadowBlur = 6;
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 2;

        // Position: Bottom-right with padding
        const padding = Math.max(Math.round(canvas.width * 0.02), 15);
        const x = canvas.width - padding;
        const y = canvas.height - padding;

        // Draw watermark background box (subtle dark capsule)
        const text = 'DSEU Unfiltered';
        const textWidth = ctx.measureText(text).width;
        const boxPadding = 8;
        const boxWidth = textWidth + boxPadding * 2;
        const boxHeight = fontSize + boxPadding * 2;
        
        ctx.fillStyle = 'rgba(9, 9, 11, 0.4)'; // zinc-950 with opacity
        ctx.shadowBlur = 0; // Disable shadow for box
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
        
        // Draw rounded rectangle background capsule
        const rx = x - textWidth - boxPadding;
        const ry = y - fontSize - boxPadding + 4;
        
        // Simple rounded rect
        ctx.beginPath();
        ctx.roundRect ? ctx.roundRect(rx, ry, boxWidth, boxHeight, 8) : ctx.rect(rx, ry, boxWidth, boxHeight);
        ctx.fill();

        // Draw watermark text in neon cyan-purple gradient style (fallback to white with opacity)
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)'; // White with 70% opacity
        ctx.fillText(text, x, y);

        // Convert canvas back to blob preserving quality
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error('Canvas to Blob conversion failed.'));
            }
          },
          file.type,
          0.92 // 92% image quality compression preservation
        );
      };
      img.onerror = () => reject(new Error('Failed to load image.'));
      img.src = event.target.result;
    };
    reader.onerror = () => reject(new Error('Failed to read file.'));
    reader.readAsDataURL(file);
  });
}
