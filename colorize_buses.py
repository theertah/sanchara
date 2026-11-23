from PIL import Image, ImageDraw, ImageFont
import numpy as np

def create_styled_bus(reference_path, out_path, livery_type="ordinary"):
    im = Image.open(reference_path).convert("RGBA")
    data = np.array(im)
    
    # Identify black lines (ink) vs white regions
    # Ink: low brightness (R,G,B < 100)
    # Background / panels: high brightness (R,G,B > 200)
    r, g, b, a = data[:,:,0], data[:,:,1], data[:,:,2], data[:,:,3]
    ink_mask = (r < 110) & (g < 110) & (b < 110)

    # Flood fill outer background to make it transparent
    from scipy.ndimage import binary_dilation
    
    # We can flood fill from edges to identify true outside background
    from collections import deque
    h, w = data.shape[:2]
    outside = np.zeros((h, w), dtype=bool)
    q = deque()
    
    # Push border pixels that are white
    for x in range(w):
        if not ink_mask[0, x]: outside[0, x] = True; q.append((0, x))
        if not ink_mask[h-1, x]: outside[h-1, x] = True; q.append((h-1, x))
    for y in range(h):
        if not ink_mask[y, 0]: outside[y, 0] = True; q.append((y, 0))
        if not ink_mask[y, w-1]: outside[y, w-1] = True; q.append((y, w-1))
        
    while q:
        cy, cx = q.popleft()
        for dy, dx in [(-1,0), (1,0), (0,-1), (0,1)]:
            ny, nx = cy + dy, cx + dx
            if 0 <= ny < h and 0 <= nx < w and not outside[ny, nx] and not ink_mask[ny, nx]:
                outside[ny, nx] = True
                q.append((ny, nx))
                
    # Inside the bus: not outside and not ink
    inside_mask = (~outside) & (~ink_mask)
    
    # Base canvas
    colored = np.zeros((h, w, 4), dtype=np.uint8)
    
    if livery_type == "ordinary":
        # BMTC Ordinary: Navy Blue body (#173B64), Cream stripe, Light blue windows
        body_color = np.array([23, 59, 100, 255], dtype=np.uint8)
        cream_color = np.array([245, 237, 220, 255], dtype=np.uint8)
        glass_color = np.array([160, 210, 235, 230], dtype=np.uint8)
        wheel_color = np.array([30, 32, 38, 255], dtype=np.uint8)
        
        # Apply body color
        colored[inside_mask] = body_color
        
        # Approximate window region: y between 120 and 260
        y_indices, x_indices = np.where(inside_mask)
        for y, x in zip(y_indices, x_indices):
            # Windows are in the upper-mid section
            if 115 <= y <= 245 and x > 75:
                colored[y, x] = glass_color
            # Cream stripe below windows
            elif 246 <= y <= 275 and x > 75:
                colored[y, x] = cream_color
            # Wheels region
            elif y >= 320:
                colored[y, x] = wheel_color
    else:
        # Volvo Vajra: Metallic Deep Royal Blue (#102B49), Tinted Glass, Cyan / Coral stripe
        body_color = np.array([16, 43, 73, 255], dtype=np.uint8)
        coral_color = np.array([217, 118, 98, 255], dtype=np.uint8)
        glass_color = np.array([35, 60, 85, 240], dtype=np.uint8)
        wheel_color = np.array([20, 22, 28, 255], dtype=np.uint8)
        
        colored[inside_mask] = body_color
        y_indices, x_indices = np.where(inside_mask)
        for y, x in zip(y_indices, x_indices):
            if 115 <= y <= 245 and x > 75:
                colored[y, x] = glass_color
            elif 246 <= y <= 265 and x > 75:
                colored[y, x] = coral_color
            elif y >= 320:
                colored[y, x] = wheel_color

    # Re-apply crisp ink lines on top
    ink_color = np.array([15, 20, 28, 255], dtype=np.uint8)
    colored[ink_mask] = ink_color
    
    # Destination board illumination
    # Usually around y 85-115, x 110-270
    dest_mask = (y_indices >= 80) & (y_indices <= 118) & (x_indices >= 105) & (x_indices <= 280)
    for y, x in zip(y_indices[dest_mask], x_indices[dest_mask]):
        if not ink_mask[y, x]:
            colored[y, x] = [15, 22, 30, 255] # LED backplate

    result_im = Image.fromarray(colored, mode="RGBA")
    
    # Draw glowing text on destination sign
    draw = ImageDraw.Draw(result_im)
    dest_text = "BMTC  MAJESTIC" if livery_type == "ordinary" else "VAJRA  AIRPORT"
    text_color = (255, 200, 50, 255) if livery_type == "ordinary" else (0, 229, 255, 255)
    draw.text((125, 92), dest_text, fill=text_color)
    
    result_im.save(out_path, "PNG")
    print(f"[SUCCESS] Saved {livery_type} bus image to {out_path}")

create_styled_bus('frontend/assets/img/reference_bus.png', 'frontend/assets/img/bmtc_ordinary_bus.png', 'ordinary')
create_styled_bus('frontend/assets/img/reference_bus.png', 'frontend/assets/img/bmtc_vajra_bus.png', 'vajra')
