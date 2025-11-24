from PIL import Image
import sys
import os

def process_image(input_path, output_path):
    try:
        img = Image.open(input_path)
        
        # 1. Crop to center (assuming the brain is roughly centered)
        width, height = img.size
        # The screenshot likely has UI, so we need a heuristic or just a center crop
        # Let's assume the user centered the view.
        # We'll take a square crop from the center.
        size = min(width, height) * 0.6 # Take 60% of the smallest dimension
        left = (width - size) / 2
        top = (height - size) / 2
        right = (width + size) / 2
        bottom = (height + size) / 2
        
        img = img.crop((left, top, right, bottom))
        
        # 2. Resize to 128x128
        img = img.resize((128, 128), Image.Resampling.LANCZOS)
        
        # 3. Remove Background (Simple color keying)
        # The screenshot background seems to be white/light gray.
        # We'll convert to RGBA and make near-white pixels transparent.
        img = img.convert("RGBA")
        datas = img.getdata()
        
        newData = []
        for item in datas:
            # Check if pixel is light (background)
            # Adjust threshold as needed. 240 is a safe bet for white/light gray.
            if item[0] > 240 and item[1] > 240 and item[2] > 240:
                newData.append((255, 255, 255, 0)) # Transparent
            else:
                newData.append(item)
        
        img.putdata(newData)
        
        # Save
        img.save(output_path, "PNG")
        print(f"Successfully processed {input_path} to {output_path}")
        
    except Exception as e:
        print(f"Error processing {input_path}: {e}")

# Process the first uploaded image
input_file = "/Users/xyx/.gemini/antigravity/brain/878ec925-4ee3-473c-a3da-7e16a7884dfd/uploaded_image_0_1763981023248.png"
output_file = "extension_v2/logo128.png"

process_image(input_file, output_file)
