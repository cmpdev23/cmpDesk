#!/usr/bin/env python3
"""
Script to generate a valid .ico file for Electron Builder.
Electron Builder requires icons to be at least 256x256 pixels.

This script:
1. Creates a professional-looking logo if no source exists
2. Generates a .ico with all required sizes (16, 24, 32, 48, 64, 128, 256)

Usage:
    python scripts/generate_icon.py
    python scripts/generate_icon.py --source path/to/source.png
"""

import argparse
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont


# Required icon sizes for Windows .ico (electron-builder requirement)
ICO_SIZES = [16, 24, 32, 48, 64, 128, 256]

# Output paths
ASSETS_DIR = Path(__file__).parent.parent / "assets"
OUTPUT_ICO = ASSETS_DIR / "logo.ico"
OUTPUT_PNG = ASSETS_DIR / "logo.png"


def create_logo_image(size: int = 512) -> Image.Image:
    """
    Create a professional logo for cmpDesk.
    Uses a modern gradient-style design with 'CM' initials.
    
    Args:
        size: Base size for the logo (will be resized as needed)
    
    Returns:
        PIL Image object
    """
    # Create RGBA image with transparency
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    # Colors - Modern blue gradient feel
    primary_color = (59, 130, 246)      # Blue-500
    secondary_color = (37, 99, 235)     # Blue-600
    accent_color = (255, 255, 255)      # White
    
    # Draw rounded rectangle background
    padding = size // 10
    corner_radius = size // 5
    
    # Create rounded rectangle
    draw_rounded_rectangle(
        draw, 
        (padding, padding, size - padding, size - padding),
        corner_radius,
        primary_color
    )
    
    # Draw inner accent (subtle gradient effect simulation)
    inner_padding = size // 6
    inner_radius = size // 6
    draw_rounded_rectangle(
        draw,
        (inner_padding, inner_padding, size - inner_padding, size // 2 + inner_padding),
        inner_radius,
        secondary_color
    )
    
    # Draw "CM" text
    text = "CM"
    font_size = size // 2
    
    try:
        # Try to use a nice font if available
        font = ImageFont.truetype("arial.ttf", font_size)
    except (OSError, IOError):
        try:
            font = ImageFont.truetype("Arial", font_size)
        except (OSError, IOError):
            # Fallback to default font
            font = ImageFont.load_default()
    
    # Calculate text position (centered)
    bbox = draw.textbbox((0, 0), text, font=font)
    text_width = bbox[2] - bbox[0]
    text_height = bbox[3] - bbox[1]
    
    x = (size - text_width) // 2
    y = (size - text_height) // 2 - bbox[1]  # Adjust for font baseline
    
    # Draw text with slight shadow for depth
    shadow_offset = size // 50
    draw.text((x + shadow_offset, y + shadow_offset), text, fill=(0, 0, 0, 80), font=font)
    draw.text((x, y), text, fill=accent_color, font=font)
    
    return img


def draw_rounded_rectangle(draw: ImageDraw.Draw, coords: tuple, radius: int, fill: tuple):
    """
    Draw a rounded rectangle.
    
    Args:
        draw: ImageDraw object
        coords: (x1, y1, x2, y2) coordinates
        radius: Corner radius
        fill: Fill color tuple
    """
    x1, y1, x2, y2 = coords
    
    # Draw main rectangle
    draw.rectangle([x1 + radius, y1, x2 - radius, y2], fill=fill)
    draw.rectangle([x1, y1 + radius, x2, y2 - radius], fill=fill)
    
    # Draw corners
    draw.pieslice([x1, y1, x1 + radius * 2, y1 + radius * 2], 180, 270, fill=fill)
    draw.pieslice([x2 - radius * 2, y1, x2, y1 + radius * 2], 270, 360, fill=fill)
    draw.pieslice([x1, y2 - radius * 2, x1 + radius * 2, y2], 90, 180, fill=fill)
    draw.pieslice([x2 - radius * 2, y2 - radius * 2, x2, y2], 0, 90, fill=fill)


def resize_for_ico(img: Image.Image, sizes: list[int]) -> list[Image.Image]:
    """
    Resize an image to multiple sizes for .ico generation.
    
    Args:
        img: Source PIL Image
        sizes: List of target sizes
    
    Returns:
        List of resized PIL Images
    """
    resized = []
    for size in sizes:
        # Use high-quality resampling
        resized_img = img.resize((size, size), Image.Resampling.LANCZOS)
        resized.append(resized_img)
    return resized


def generate_ico(source_img: Image.Image, output_path: Path) -> None:
    """
    Generate a .ico file with all required sizes.
    
    Args:
        source_img: Source PIL Image (should be at least 256x256)
        output_path: Path for output .ico file
    """
    # Resize to all required sizes
    images = resize_for_ico(source_img, ICO_SIZES)
    
    # Save as .ico (largest first)
    images.reverse()  # ICO format expects largest first
    images[0].save(
        output_path,
        format='ICO',
        sizes=[(s, s) for s in reversed(ICO_SIZES)]
    )
    
    print(f"✓ Generated {output_path}")
    print(f"  Sizes: {', '.join(f'{s}x{s}' for s in ICO_SIZES)}")


def generate_png(source_img: Image.Image, output_path: Path, size: int = 512) -> None:
    """
    Generate a high-resolution PNG for other uses.
    
    Args:
        source_img: Source PIL Image
        output_path: Path for output .png file
        size: Target size for PNG
    """
    png_img = source_img.resize((size, size), Image.Resampling.LANCZOS)
    png_img.save(output_path, format='PNG')
    print(f"✓ Generated {output_path} ({size}x{size})")


def main():
    parser = argparse.ArgumentParser(
        description="Generate icon files for cmpDesk Electron app"
    )
    parser.add_argument(
        "--source", "-s",
        type=Path,
        help="Source image file (PNG recommended, at least 512x512)"
    )
    parser.add_argument(
        "--no-png",
        action="store_true",
        help="Skip PNG generation"
    )
    args = parser.parse_args()
    
    # Ensure assets directory exists
    ASSETS_DIR.mkdir(parents=True, exist_ok=True)
    
    # Load or create source image
    if args.source and args.source.exists():
        print(f"Loading source image: {args.source}")
        source_img = Image.open(args.source).convert('RGBA')
        
        # Check minimum size
        if source_img.width < 256 or source_img.height < 256:
            print(f"⚠ Warning: Source image is {source_img.width}x{source_img.height}")
            print("  Recommended minimum: 256x256 (512x512 for best quality)")
    else:
        print("No source image provided, creating default logo...")
        source_img = create_logo_image(512)
    
    # Generate .ico
    generate_ico(source_img, OUTPUT_ICO)
    
    # Generate .png (optional)
    if not args.no_png:
        generate_png(source_img, OUTPUT_PNG)
    
    print("\n✓ Icon generation complete!")
    print(f"  ICO: {OUTPUT_ICO}")
    if not args.no_png:
        print(f"  PNG: {OUTPUT_PNG}")


if __name__ == "__main__":
    main()
