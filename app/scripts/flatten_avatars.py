from PIL import Image
import glob, os
for p in sorted(glob.glob(r'I:/Agent茶话会/app/resources/characters/*/avatar.png')):
    im=Image.open(p).convert('RGBA')
    bg=Image.new('RGB', im.size, (10,12,22))
    bg.paste(im, (0,0), im)
    bg.save(p)
    print(os.path.basename(os.path.dirname(p)), os.path.getsize(p))
