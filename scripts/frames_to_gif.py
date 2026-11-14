"""Joins test/out/frames/*.png into docs/demo.gif (needs Pillow)."""
import glob, os
from PIL import Image
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
frames = [Image.open(f).convert("RGB") for f in sorted(glob.glob(os.path.join(root, "test/out/frames/*.png")))]
frames = [f.resize((800, int(800 * f.height / f.width)), Image.LANCZOS).quantize(colors=128, method=Image.Quantize.MEDIANCUT) for f in frames]
frames[0].save(os.path.join(root, "docs/demo.gif"), save_all=True, append_images=frames[1:], duration=110, loop=0, optimize=True)
print(len(frames), "frames ->", os.path.getsize(os.path.join(root, "docs/demo.gif")) // 1024, "KB")
