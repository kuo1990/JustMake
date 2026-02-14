import os

def create_die_svg(value, filename):
    # Colors
    die_bg = "#FDFBF7" # Ivory-ish white with slight warmth
    die_border = "#E6E2D6"
    dot_black = "#111111"
    dot_red = "#D32F2F"
    
    # Dot configurations (cx, cy) in a 100x100 viewbox
    # 0-100. Padding 10. effective area 20-80. center 50.
    # Radius 8 for normal, 14 for big one (Die 1)
    
    dots = []
    dot_color = dot_black
    radius = 8.5
    
    c = 50
    # Spacing
    d = 26 # distance from center
    
    if value == 1:
        dots = [(c, c)]
        dot_color = dot_red
        radius = 16 # Big red dot
    elif value == 2:
        dots = [(c, c-d), (c, c+d)]
        # Rotation usually 2 is diagonal? Let's do simple vertical or diagonal?
        # Standard: Diagonal. (25, 25) and (75, 75)?
        # Let's stick to simple grid logic for consistency.
        # (25, 25) and (75, 75)
        dots = [(28, 28), (72, 72)]
    elif value == 3:
        dots = [(28, 28), (50, 50), (72, 72)]
    elif value == 4:
        dots = [(26, 26), (74, 26), (26, 74), (74, 74)]
        dot_color = dot_red
    elif value == 5:
        dots = [(26, 26), (74, 26), (50, 50), (26, 74), (74, 74)]
    elif value == 6:
        # Two rows of 3?? Or two cols of 3. Usually 2 cols vertical.
        dots = [
            (28, 22), (28, 50), (28, 78),
            (72, 22), (72, 50), (72, 78)
        ]

    svg_content = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <defs>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur in="SourceAlpha" stdDeviation="2"/>
      <feOffset dx="1" dy="2" result="offsetblur"/>
      <feComponentTransfer>
        <feFuncA type="linear" slope="0.3"/>
      </feComponentTransfer>
      <feMerge> 
        <feMergeNode/>
        <feMergeNode in="SourceGraphic"/> 
      </feMerge>
    </filter>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#FFF;stop-opacity:1" />
      <stop offset="100%" style="stop-color:{die_bg};stop-opacity:1" />
    </linearGradient>
  </defs>
  
  <!-- Die Body -->
  <rect x="2" y="2" width="96" height="96" rx="16" ry="16" fill="url(#grad)" stroke="{die_border}" stroke-width="1" filter="url(#shadow)"/>
  
  <!-- Dots -->
  <g fill="{dot_color}">'''
    
    for (cx, cy) in dots:
        svg_content += f'\n    <circle cx="{cx}" cy="{cy}" r="{radius}"/>'
        
    svg_content += '''
  </g>
</svg>'''

    with open(filename, 'w') as f:
        f.write(svg_content)

# Generate
output_dir = "/Users/kuo/.gemini/antigravity/brain/b0b380d6-8dee-42a6-849d-ca97fbd27514"
for i in range(1, 7):
    create_die_svg(i, os.path.join(output_dir, f"die_face_{i}.svg"))

print("Dice SVGs generated.")
