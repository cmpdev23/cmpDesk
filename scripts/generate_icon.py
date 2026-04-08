#!/usr/bin/env python3
"""
Script to generate a valid .ico file for Electron Builder.
Electron Builder requires icons to be at least 256x256 pixels.

This script:
1. Creates a professional-looking logo matching the Figma design
2. Generates a .ico with all required sizes (16, 24, 32, 48, 64, 128, 256)

Design: Circular icon with:
- Dark gray outer ring border
- White middle ring
- Purple/indigo inner circle fill
- "DESK" text in bold italic black

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

# Design colors (from Figma)
OUTER_RING_COLOR = (55, 55, 60)         # Dark gray/charcoal
WHITE_RING_COLOR = (255, 255, 255)       # White
INNER_CIRCLE_COLOR = (88, 101, 242)      # Purple/Indigo (#5865F2)
TEXT_COLOR = (45, 45, 50)                # Dark text color


def create_logo_image(size: int = 512) -> Image.Image:
    """
    Create the cmpDesk logo matching the Figma design.
    
    Design structure:
    - Outer dark gray ring (border)
    - White ring (middle layer)
    - Purple/indigo filled circle (inner)
    - "DESK" text in bold italic black
    
    Args:
        size: Base size for the logo (will be resized as needed)
    
    Returns:
        PIL Image object
    """
    # Create RGBA image with transparency
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    # Calculate ring dimensions
    center = size // 2
    
    # Outer ring (dark gray) - full circle
    outer_radius = size // 2 - 2
    draw.ellipse(
        [center - outer_radius, center - outer_radius,
         center + outer_radius, center + outer_radius],
        fill=OUTER_RING_COLOR
    )
    
    # White ring (middle layer)
    white_ring_radius = int(outer_radius * 0.92)
    draw.ellipse(
        [center - white_ring_radius, center - white_ring_radius,
         center + white_ring_radius, center + white_ring_radius],
        fill=WHITE_RING_COLOR
    )
    
    # Inner purple circle
    inner_radius = int(outer_radius * 0.82)
    draw.ellipse(
        [center - inner_radius, center - inner_radius,
         center + inner_radius, center + inner_radius],
        fill=INNER_CIRCLE_COLOR
    )
    
    # Draw "DESK" text
    text = "DESK"
    font_size = int(size * 0.28)
    
    font = _get_bold_italic_font(font_size)
    
    # Calculate text position (centered)
    bbox = draw.textbbox((0, 0), text, font=font)
    text_width = bbox[2] - bbox[0]
    text_height = bbox[3] - bbox[1]
    
    x = (size - text_width) // 2
    y = (size - text_height) // 2 - bbox[1]  # Adjust for font baseline
    
    # Draw text
    draw.text((x, y), text, fill=TEXT_COLOR, font=font)
    
    return img


def _get_bold_italic_font(font_size: int) -> ImageFont.FreeTypeFont:
    """
    Get a bold italic font for the logo text.
    Tries multiple font options for cross-platform compatibility.
    
    Args:
        font_size: Desired font size
    
    Returns:
        PIL ImageFont object
    """
    # Font candidates in order of preference (bold italic)
    font_candidates = [
        "arialbi.ttf",          # Arial Bold Italic (Windows)
        "Arial Bold Italic.ttf",
        "Arial-BoldItalicMT",   # macOS
        "DejaVuSans-BoldOblique.ttf",  # Linux
        "arialbd.ttf",          # Arial Bold (fallback)
        "Arial Bold.ttf",
        "arial.ttf",            # Arial Regular (fallback)
        "Arial.ttf",
    ]
    
    for font_name in font_candidates:
        try:
            return ImageFont.truetype(font_name, font_size)
        except (OSError, IOError):
            continue
    
    # Final fallback to default font
    return ImageFont.load_default()


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
